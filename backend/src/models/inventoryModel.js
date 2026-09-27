import { query, getClient } from "../config/db.js";
import { splitCountedRows } from "../utils/pagination.js";

// `total_stock` and `status` are derived here, not stored (see migrations/…_inventory-backend.js)
// — one query, aggregating variants via json_agg so the list stays a single round trip rather
// than N+1 (P1-6 precedent: on one vCPU with a small pool, one query beats several concurrent
// ones). `status` mirrors exactly what the frontend used to compute client-side
// (InventoryTable.jsx: `isLow = variants.some(v => v.current <= v.min)`).
// `whereSql` is filtered in the WHERE clause (before GROUP BY), not HAVING, so a single-item
// lookup doesn't have to aggregate the whole table first.
const itemSelect = (whereSql = '') => `
  SELECT
    i.id, i.name, i.category, i.unit, i.created_at, i.updated_at,
    COALESCE(SUM(v.current_stock), 0)::int AS total_stock,
    CASE WHEN bool_or(v.current_stock <= v.min_stock) THEN 'Low' ELSE 'Good' END AS status,
    COALESCE(
      json_agg(
        json_build_object(
          'id', v.id,
          'name', v.variant_name,
          'current', v.current_stock,
          'min', v.min_stock
        ) ORDER BY v.id
      ) FILTER (WHERE v.id IS NOT NULL),
      '[]'
    ) AS variants
  FROM inventory_items i
  LEFT JOIN item_variants v ON v.item_id = i.id
  ${whereSql}
  GROUP BY i.id
`;

// P1-3: capped-only (SKU-bounded, no paging UI). LIMIT/OFFSET and ORDER BY are applied to a wrap
// around itemSelect() rather than appended inline — itemSelect() already ends on `GROUP BY i.id`
// used by getItemById too, and asserting the ORDER BY at the same level as LIMIT/OFFSET (rather
// than inside the subquery, whose ordering Postgres doesn't guarantee survives an outer wrap) is
// what keeps this correct. Paging still counts *items*, not the variant rows the GROUP BY
// collapses, since itemSelect()'s aggregation runs first.
export async function getAllItems({ limit, offset }) {
  const { rows } = await query(
    `SELECT t.*, COUNT(*) OVER() AS total_count
     FROM (${itemSelect()}) t
     ORDER BY t.name ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return splitCountedRows(rows);
}

export async function getItemById(id) {
  const { rows } = await query(itemSelect('WHERE i.id = $1'), [id]);
  return rows[0] || null;
}

// P1-3: capped-only (low-stock variants are expected to be a small subset, no paging UI).
export async function getLowStock({ limit, offset }) {
  const { rows } = await query(
    `SELECT
       v.id AS variant_id, v.variant_name, v.current_stock, v.min_stock,
       i.id AS item_id, i.name AS item_name, i.category, i.unit,
       COUNT(*) OVER() AS total_count
     FROM item_variants v
     JOIN inventory_items i ON i.id = v.item_id
     WHERE v.current_stock <= v.min_stock
     ORDER BY i.name ASC, v.variant_name ASC, v.id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return splitCountedRows(rows);
}

export async function createItemWithVariants({ name, category, unit, variants }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const itemRes = await client.query(
      `INSERT INTO inventory_items (name, category, unit) VALUES ($1, $2, $3) RETURNING id`,
      [name, category, unit]
    );
    const itemId = itemRes.rows[0].id;

    const named = (variants || []).filter((v) => v.name && v.name.trim() !== '');
    if (named.length > 0) {
      await client.query(
        `INSERT INTO item_variants (item_id, variant_name, current_stock, min_stock)
         SELECT $1, n, 0, m
         FROM unnest($2::text[], $3::int[]) AS t(n, m)`,
        [itemId, named.map((v) => v.name), named.map((v) => v.minStock ?? 5)]
      );
    }

    await client.query('COMMIT');
    return itemId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in createItemWithVariants:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Surviving variants (matched by id) keep their current_stock — this is an edit to the item's
// definition (name/category/unit/variant labels/min_stock), not a stock adjustment. New variants
// (no id, or an id not already on this item) start at 0. Removed variants are deleted; their
// stock_movements rows CASCADE away with them (see migration).
export async function updateItemWithVariants(id, { name, category, unit, variants }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const itemRes = await client.query(
      `UPDATE inventory_items SET name = $1, category = $2, unit = $3, updated_at = now()
       WHERE id = $4 RETURNING id`,
      [name, category, unit, id]
    );
    if (itemRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const existingRes = await client.query(
      `SELECT id FROM item_variants WHERE item_id = $1`,
      [id]
    );
    const existingIds = new Set(existingRes.rows.map((r) => r.id));

    const named = (variants || []).filter((v) => v.name && v.name.trim() !== '');
    const keepIds = new Set();

    const toUpdate = named.filter((v) => v.id != null && existingIds.has(v.id));
    const toInsert = named.filter((v) => v.id == null || !existingIds.has(v.id));

    for (const v of toUpdate) {
      keepIds.add(v.id);
      await client.query(
        `UPDATE item_variants SET variant_name = $1, min_stock = $2 WHERE id = $3`,
        [v.name, v.minStock ?? 5, v.id]
      );
    }

    if (toInsert.length > 0) {
      await client.query(
        `INSERT INTO item_variants (item_id, variant_name, current_stock, min_stock)
         SELECT $1, n, 0, m
         FROM unnest($2::text[], $3::int[]) AS t(n, m)`,
        [id, toInsert.map((v) => v.name), toInsert.map((v) => v.minStock ?? 5)]
      );
    }

    const toDelete = [...existingIds].filter((existingId) => !keepIds.has(existingId));
    if (toDelete.length > 0) {
      await client.query(`DELETE FROM item_variants WHERE id = ANY($1::int[])`, [toDelete]);
    }

    await client.query('COMMIT');
    return id;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in updateItemWithVariants:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteItem(id) {
  const { rowCount } = await query(`DELETE FROM inventory_items WHERE id = $1`, [id]);
  return rowCount > 0;
}

export async function getVariantById(variantId) {
  const { rows } = await query(`SELECT id, item_id, current_stock FROM item_variants WHERE id = $1`, [variantId]);
  return rows[0] || null;
}

// Sentinels adjustVariantStock can return instead of a resulting-stock number. `null` keeps its
// pre-FR-3 meaning ("no such variant" or "would go negative" — the service disambiguates with a
// follow-up lookup); OVER_RETURN is new and distinct, since it's a different 409 message and
// doesn't need that follow-up lookup.
export const OVER_RETURN = Symbol('over-return');

// The concurrency-critical write: current_stock is adjusted and the audit row is written in one
// transaction, with the guard against going negative expressed directly in the UPDATE's WHERE
// clause rather than as a separate read-then-check — so two concurrent adjustments on the same
// variant serialize correctly instead of racing on a stale read. A zero rowCount means either
// "no such variant" or "would go negative"; the service disambiguates with a follow-up lookup.
//
// FR-3: `projectId` optionally tags the movement as consumed by / returned to a project (the
// schema layer already restricts which reason/delta combinations may carry one — see
// schemas/inventorySchemas.js). A 'Returned' movement is additionally checked here, inside the
// same transaction, against that project+variant's net consumption so far — the UPDATE above
// already serializes concurrent adjustments to this variant, so this read can't race with
// another adjustment to the same variant.
export async function adjustVariantStock(variantId, delta, reason, userId, projectId = null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const updateRes = await client.query(
      `UPDATE item_variants
       SET current_stock = current_stock + $2
       WHERE id = $1 AND current_stock + $2 >= 0
       RETURNING current_stock`,
      [variantId, delta]
    );

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    if (reason === 'Returned' && projectId != null) {
      const netRes = await client.query(
        `SELECT COALESCE(-SUM(delta), 0)::int AS net_used
         FROM stock_movements
         WHERE variant_id = $1 AND project_id = $2`,
        [variantId, projectId]
      );
      if (delta > netRes.rows[0].net_used) {
        await client.query('ROLLBACK');
        return OVER_RETURN;
      }
    }

    const resultingStock = updateRes.rows[0].current_stock;
    await client.query(
      `INSERT INTO stock_movements (variant_id, user_id, delta, resulting_stock, reason, project_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [variantId, userId, delta, resultingStock, reason || null, projectId]
    );

    await client.query('COMMIT');
    return resultingStock;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in adjustVariantStock:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// P1-3: paged — an append-only audit log with no ceiling, the strongest case for pagination in
// the codebase. `m.id DESC` tiebreaks `created_at`, which can tie on rapid adjustments.
export async function getVariantMovements(variantId, { limit, offset }) {
  const { rows } = await query(
    `SELECT
       m.id, m.variant_id, m.user_id, m.delta, m.resulting_stock, m.reason, m.project_id,
       m.created_at, u.first_name, u.last_name, COUNT(*) OVER() AS total_count
     FROM stock_movements m
     LEFT JOIN users u ON u.user_id = m.user_id
     WHERE m.variant_id = $1
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $2 OFFSET $3`,
    [variantId, limit, offset]
  );
  return splitCountedRows(rows);
}

// FR-3: a project's "materials consumed" record — one row per variant this project has ever
// touched, netting 'Used' against 'Returned' movements. Capped-only (a project draws from a
// small, bounded set of variants in practice), following the same pattern as getLowStock.
export async function getProjectMaterials(projectId, { limit, offset }) {
  const { rows } = await query(
    `SELECT
       i.id AS item_id, i.name AS item_name, i.unit,
       v.id AS variant_id, v.variant_name,
       COALESCE(-SUM(m.delta) FILTER (WHERE m.delta < 0), 0)::int AS used,
       COALESCE(SUM(m.delta) FILTER (WHERE m.delta > 0), 0)::int AS returned,
       COALESCE(-SUM(m.delta), 0)::int AS net_used,
       COUNT(*) OVER() AS total_count
     FROM stock_movements m
     JOIN item_variants v ON v.id = m.variant_id
     JOIN inventory_items i ON i.id = v.item_id
     WHERE m.project_id = $1
     GROUP BY i.id, i.name, v.id, v.variant_name
     ORDER BY i.name ASC, v.variant_name ASC, v.id ASC
     LIMIT $2 OFFSET $3`,
    [projectId, limit, offset]
  );
  return splitCountedRows(rows);
}
