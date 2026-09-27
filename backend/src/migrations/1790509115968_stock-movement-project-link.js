// FR-3 (final clause): link a stock movement to the project it was consumed by / returned to.
// SET NULL, not CASCADE — deleting a project must not rewrite inventory history, since the stock
// genuinely left (or came back). The rule that only 'Used'/'Returned' movements carry a
// project_id lives in schemas/inventorySchemas.js and services/inventoryService.js, not a CHECK
// constraint here, since SET NULL on a project delete would otherwise violate a NOT-NULL-with-
// reason CHECK on old rows.
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumns('stock_movements', {
    project_id: {
      type: 'integer',
      references: 'projects',
      onDelete: 'SET NULL',
    },
  });
  // Partial index: only movements tagged to a project are ever looked up by project_id (the
  // per-project materials summary), and most movements will have none.
  pgm.createIndex('stock_movements', 'project_id', {
    where: 'project_id IS NOT NULL',
  });
};

export const down = (pgm) => {
  pgm.dropColumns('stock_movements', ['project_id']);
};
