// P1-11: Inventory backend. `inventory_items`/`item_variants` have existed since the initial
// migration but have never been read or written by any server code — the Inventory screen
// persists everything to localStorage instead (see ARCHITECTURE_REVIEW.md P1-11). Both tables
// are therefore empty in every real environment; every change below is a free schema change,
// not a data migration.
//
// `total_stock` and `status` are dropped from `inventory_items` — both are derivable from the
// item's variants (sum of current_stock; 'Low' if any variant is at/under its min_stock) and
// keeping them as stored columns would create the same two-sources-of-truth defect PRD B.6
// already flags for `projects.status`. `models/inventoryModel.js` computes both on read, so the
// API response shape (and therefore the frontend) is unaffected.
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.dropColumn('inventory_items', ['total_stock', 'status']);
  pgm.addColumns('inventory_items', {
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  // Matches the exact category options the add/edit form offers (InventoryTable.jsx) — a CHECK
  // rather than a new enum type, following the attendance_status_check precedent: cheaper to
  // extend if a fourth category is ever added.
  pgm.addConstraint('inventory_items', 'inventory_items_category_check', {
    check: "category IN ('Raw Material', 'Tool', 'Consumable')",
  });

  // item_id was nullable despite having an FK — an orphan variant is meaningless, so tighten it
  // now while the table is still empty in every real environment.
  pgm.alterColumn('item_variants', 'item_id', { notNull: true });
  pgm.addConstraint('item_variants', 'item_variants_item_id_variant_name_unique', {
    unique: ['item_id', 'variant_name'],
  });
  pgm.addConstraint('item_variants', 'item_variants_current_stock_check', {
    check: 'current_stock >= 0',
  });
  pgm.addConstraint('item_variants', 'item_variants_min_stock_check', {
    check: 'min_stock >= 0',
  });
  pgm.createIndex('item_variants', 'item_id');

  // The FR-3 audit trail: who, when, how much, and why for every stock adjustment.
  // `resulting_stock` makes the history replayable without recomputing from deltas.
  pgm.createTable('stock_movements', {
    id: 'id',
    variant_id: {
      type: 'integer',
      notNull: true,
      references: 'item_variants',
      onDelete: 'CASCADE',
    },
    // SET NULL (not CASCADE, unlike most FKs to users in this schema, and not RESTRICT): a
    // DELETE /api/users/:id is a live Admin action. CASCADE would silently erase audit history
    // when an account is removed; RESTRICT would start failing that endpoint the moment any
    // user has ever touched stock. SET NULL preserves both the endpoint and the record.
    user_id: {
      type: 'bigint',
      references: 'users',
      onDelete: 'SET NULL',
    },
    delta: { type: 'integer', notNull: true },
    resulting_stock: { type: 'integer', notNull: true },
    reason: { type: 'varchar(255)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('stock_movements', 'stock_movements_delta_check', { check: 'delta <> 0' });
  pgm.createIndex('stock_movements', 'variant_id');
  pgm.createIndex('stock_movements', 'created_at');
};

export const down = (pgm) => {
  pgm.dropTable('stock_movements');

  pgm.dropIndex('item_variants', 'item_id');
  pgm.dropConstraint('item_variants', 'item_variants_min_stock_check');
  pgm.dropConstraint('item_variants', 'item_variants_current_stock_check');
  pgm.dropConstraint('item_variants', 'item_variants_item_id_variant_name_unique');
  pgm.alterColumn('item_variants', 'item_id', { notNull: false });

  pgm.dropConstraint('inventory_items', 'inventory_items_category_check');
  pgm.dropColumns('inventory_items', ['created_at', 'updated_at']);
  pgm.addColumns('inventory_items', {
    total_stock: { type: 'integer', notNull: true, default: 0 },
    status: { type: 'varchar(50)', notNull: true, default: 'Good' },
  });
};
