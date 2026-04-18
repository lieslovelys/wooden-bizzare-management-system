import { query, getClient } from "../config/db.js";

// ============================================================
// PROFIT MODEL
// ============================================================

export async function getProfitByProjectId(projectId) {
  const { rows } = await query(
    `SELECT * FROM project_profit WHERE project_id = $1 LIMIT 1`, [projectId]
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

export async function upsertProfit(projectId, { client_payment, worker_wages, materials_cost, other_expenses, expense_items = [] }) {
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
         SET client_payment = $1, worker_wages = $2, materials_cost = $3, other_expenses = $4, updated_at = NOW()
         WHERE project_id = $5
         RETURNING *`,
        [client_payment, worker_wages, materials_cost, other_expenses, projectId]
      );
      profit = updateResult.rows[0];
    } else {
      // Insert new record
      const insertResult = await client.query(
        `INSERT INTO project_profit (project_id, client_payment, worker_wages, materials_cost, other_expenses, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [projectId, client_payment, worker_wages, materials_cost, other_expenses]
      );
      profit = insertResult.rows[0];
    }

    // Delete existing expense items
    await client.query(`DELETE FROM project_expense_items WHERE profit_id = $1`, [profit.id]);

    // Insert new expense items
    for (const item of expense_items) {
      await client.query(
        `INSERT INTO project_expense_items (profit_id, category, description, amount)
         VALUES ($1, $2, $3, $4)`,
        [profit.id, item.category ?? "Other Expenses", item.description, item.amount]
      );
    }

    await client.query("COMMIT");

    const { rows: items } = await query(
      `SELECT id, description, category, amount
       FROM project_expense_items
       WHERE profit_id = $1
       ORDER BY id ASC`,
      [profit.id]
    );

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
    const { rows } = await query(`
      SELECT COALESCE(SUM(net_profit), 0) AS total_monthly_profit
      FROM project_profit
      WHERE EXTRACT(MONTH FROM updated_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM updated_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    `);
    
    // Ibabalik nito ang computed profit (e.g., 34000)
    return parseFloat(rows[0].total_monthly_profit); 
  } catch (err) {
    console.error("Error getting monthly profit:", err);
    return 0; // Para safe at hindi mag-crash, ibabalik ay 0 kapag may error
  }
}