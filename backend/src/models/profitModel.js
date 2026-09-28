import { query, getClient } from "../config/db.js";
import { logger } from "../config/logger.js";

// ============================================================
// PROFIT MODEL
// ============================================================

export async function getProfitByProjectId(projectId) {
  // P1-7: project_profit.project_id is now UNIQUE, so at most one row can ever match — the
  // `LIMIT 1` this used to need to force determinism is redundant.
  const { rows } = await query(
    `SELECT * FROM project_profit WHERE project_id = $1`, [projectId]
  );

  if (rows.length === 0) {
    return {
      client_payment: 0,
      worker_wages:   0,
      materials_cost: 0,
      other_expenses: 0,
      total_expenses: 0,
      net_profit:     0,
      expense_items:  [],
    };
  }

  const profit = rows[0];
  const { rows: items } = await query(
    `SELECT id, description, category, amount
     FROM project_expense_items
     WHERE profit_id = $1
     ORDER BY id ASC`,
    [profit.id]
  );
  return { ...profit, expense_items: items };
}

// FR-7: `recorded_by` — never written by any code path before this — attributes a P&L entry to
// whoever entered it. `recordedBy` is optional so existing callers/tests that don't pass one
// don't break; the route is what actually supplies `req.session.user.user_id`.
export async function upsertProfit(projectId, { client_payment, worker_wages, materials_cost, other_expenses, expense_items = [] }, recordedBy = null) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Check if profit record exists for this project
    const existingResult = await client.query(
      `SELECT id FROM project_profit WHERE project_id = $1`,
      [projectId]
    );

    let profit;
    if (existingResult.rows.length > 0) {
      // Update existing record
      const updateResult = await client.query(
        `UPDATE project_profit
         SET client_payment = $1, worker_wages = $2, materials_cost = $3, other_expenses = $4, updated_at = NOW(), recorded_by = $6
         WHERE project_id = $5
         RETURNING *`,
        [client_payment, worker_wages, materials_cost, other_expenses, projectId, recordedBy]
      );
      profit = updateResult.rows[0];
    } else {
      // Insert new record
      const insertResult = await client.query(
        `INSERT INTO project_profit (project_id, client_payment, worker_wages, materials_cost, other_expenses, updated_at, recorded_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         RETURNING *`,
        [projectId, client_payment, worker_wages, materials_cost, other_expenses, recordedBy]
      );
      profit = insertResult.rows[0];
    }

    // Delete existing expense items
    await client.query(`DELETE FROM project_expense_items WHERE profit_id = $1`, [profit.id]);

    // P1-6: was an N-iteration insert loop followed by a re-SELECT of the rows just written,
    // *after* COMMIT (N+2 round trips). One multi-row insert via unnest(), returning what it
    // just wrote, replaces both — 2 round trips regardless of item count. Kept as
    // delete-then-reinsert rather than diffing (the review's suggested alternative):
    // frontend/src/admin/Profit.jsx builds new rows client-side with no id, so the server has
    // no stable identity to diff new vs. existing items against.
    const categories = expense_items.map((item) => item.category ?? "Other Expenses");
    const descriptions = expense_items.map((item) => item.description);
    const amounts = expense_items.map((item) => item.amount);

    const { rows: items } = await client.query(
      `INSERT INTO project_expense_items (profit_id, category, description, amount)
       SELECT $1, c, d, a
       FROM unnest($2::text[], $3::text[], $4::numeric[]) AS t(c, d, a)
       RETURNING id, description, category, amount`,
      [profit.id, categories, descriptions, amounts]
    );

    await client.query("COMMIT");

    return { ...profit, expense_items: items };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteProfitByProjectId(projectId) {
  const { rowCount } = await query(
    `DELETE FROM project_profit WHERE project_id = $1`, [projectId]
  );
  return rowCount > 0;
}

// ============================================================
// DASHBOARD STATS (Idagdag sa ibaba ng file mo)
// ============================================================

export async function getMonthlyProfit() {
  try {
    // P1-9: updated_at is timestamptz — compare against the Manila calendar month explicitly.
    const { rows } = await query(`
      SELECT COALESCE(SUM(net_profit), 0) AS total_monthly_profit
      FROM project_profit
      WHERE EXTRACT(MONTH FROM updated_at AT TIME ZONE 'Asia/Manila') = EXTRACT(MONTH FROM NOW() AT TIME ZONE 'Asia/Manila')
        AND EXTRACT(YEAR FROM updated_at AT TIME ZONE 'Asia/Manila') = EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Manila');
    `);
    
    // Ibabalik nito ang computed profit (e.g., 34000)
    return parseFloat(rows[0].total_monthly_profit);
  } catch (err) {
    // Unlike the model functions above, this one deliberately swallows the error rather than
    // rethrowing (a dashboard tile failing shouldn't 500 the whole dashboard) — so, unlike those,
    // this IS the only place this particular failure ever gets logged. Models can't touch `req`
    // (CLAUDE.md), so the shared base logger, not req.log, is the right layer here too.
    logger.error({ err }, "getMonthlyProfit: query failed, returning 0");
    return 0; // Para safe at hindi mag-crash, ibabalik ay 0 kapag may error
  }
}