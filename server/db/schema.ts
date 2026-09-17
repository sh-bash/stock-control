import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  date,
  index,
  unique,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const timestamps = {
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}

// ============================================================
// §5.1 Master Data
// ============================================================

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  type: varchar('type', { length: 30 }),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  parent_id: uuid('parent_id'),
  ...timestamps,
})

export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 30 }).notNull(),
  ...timestamps,
})

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: varchar('sku', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  category_id: uuid('category_id').references(() => productCategories.id),
  base_unit_id: uuid('base_unit_id').references(() => units.id),
  costing_method: varchar('costing_method', { length: 10 }).notNull().default('fifo'),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const productUnits = pgTable('product_units', {
  id: uuid('id').primaryKey().defaultRandom(),
  product_id: uuid('product_id').notNull().references(() => products.id),
  unit_id: uuid('unit_id').notNull().references(() => units.id),
  conversion_qty: decimal('conversion_qty', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
})

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  contact: varchar('contact', { length: 100 }),
  phone: varchar('phone', { length: 30 }),
  payment_term_days: integer('payment_term_days').notNull().default(0),
  default_lead_time_days: integer('default_lead_time_days').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const priceLevels = pgTable('price_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  ...timestamps,
})

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  contact: varchar('contact', { length: 100 }),
  phone: varchar('phone', { length: 30 }),
  payment_term_days: integer('payment_term_days').notNull().default(0),
  price_level_id: uuid('price_level_id').references(() => priceLevels.id),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const expeditions = pgTable('expeditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  contact: varchar('contact', { length: 100 }),
  default_allocation_method: varchar('default_allocation_method', { length: 20 }).notNull().default('per_value'),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const globalStockSettings = pgTable('global_stock_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  fast_moving_min_daily_out: decimal('fast_moving_min_daily_out', { precision: 18, scale: 4 }).notNull(),
  slow_moving_max_daily_out: decimal('slow_moving_max_daily_out', { precision: 18, scale: 4 }).notNull(),
  aging_warning_days: integer('aging_warning_days').notNull(),
  aging_danger_days: integer('aging_danger_days').notNull(),
  dead_stock_no_movement_days: integer('dead_stock_no_movement_days').notNull(),
  ...timestamps,
})

export const productStockSettings = pgTable(
  'product_stock_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id').notNull().references(() => products.id),
    warehouse_id: uuid('warehouse_id').references(() => warehouses.id),
    min_stock: decimal('min_stock', { precision: 18, scale: 4 }),
    reorder_point: decimal('reorder_point', { precision: 18, scale: 4 }),
    reorder_qty: decimal('reorder_qty', { precision: 18, scale: 4 }),
    fast_moving_min_daily_out: decimal('fast_moving_min_daily_out', { precision: 18, scale: 4 }),
    slow_moving_max_daily_out: decimal('slow_moving_max_daily_out', { precision: 18, scale: 4 }),
    aging_warning_days: integer('aging_warning_days'),
    aging_danger_days: integer('aging_danger_days'),
    is_active: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    // resolveEffectiveSettings() assumes at most one ACTIVE override per
    // product+warehouse (and at most one ACTIVE product-level override,
    // warehouse_id IS NULL) — without these, the UI/API let you create
    // duplicates and which one "wins" would be an arbitrary row-order
    // accident. Scoped to is_active so a deactivated row (kept for audit)
    // never blocks creating its active replacement.
    uniqueIndex('product_stock_settings_active_warehouse_unique')
      .on(table.product_id, table.warehouse_id)
      .where(sql`${table.is_active} = true AND ${table.warehouse_id} IS NOT NULL`),
    uniqueIndex('product_stock_settings_active_product_level_unique')
      .on(table.product_id)
      .where(sql`${table.is_active} = true AND ${table.warehouse_id} IS NULL`),
  ],
)

// ============================================================
// §5.8 Auth & Ops
// ============================================================

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  ...timestamps,
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role_id: uuid('role_id').notNull().references(() => roles.id),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  token_hash: varchar('token_hash', { length: 255 }).notNull(),
  expires_at: timestamp('expires_at').notNull(),
  revoked_at: timestamp('revoked_at'),
  ...timestamps,
})

export const jobExecutionLogs = pgTable('job_execution_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_name: varchar('job_name', { length: 50 }).notNull(),
  status: varchar('status', { length: 10 }).notNull(),
  rows_processed: integer('rows_processed'),
  duration_ms: integer('duration_ms'),
  error_message: text('error_message'),
  executed_at: timestamp('executed_at').notNull(),
  ...timestamps,
})

// ============================================================
// §5.6 Approval (Generic)
// ============================================================

export const approvalWorkflows = pgTable('approval_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_type: varchar('document_type', { length: 30 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const approvalSteps = pgTable('approval_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflow_id: uuid('workflow_id').notNull().references(() => approvalWorkflows.id),
  step_order: integer('step_order').notNull(),
  approver_type: varchar('approver_type', { length: 10 }).notNull(),
  approver_id: uuid('approver_id').notNull(),
  ...timestamps,
})

export const approvalInstances = pgTable('approval_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflow_id: uuid('workflow_id').notNull().references(() => approvalWorkflows.id),
  document_type: varchar('document_type', { length: 30 }).notNull(),
  document_id: uuid('document_id').notNull(),
  current_step: integer('current_step').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  ...timestamps,
})

export const approvalInstanceLogs = pgTable('approval_instance_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  instance_id: uuid('instance_id').notNull().references(() => approvalInstances.id),
  step_order: integer('step_order').notNull(),
  approver_id: uuid('approver_id').notNull().references(() => users.id),
  action: varchar('action', { length: 10 }).notNull(),
  note: text('note'),
  approved_at: timestamp('approved_at'),
  ...timestamps,
})

// ============================================================
// §5.7 Notification (Rule-based, Flexible)
// ============================================================

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 30 }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  reference_type: varchar('reference_type', { length: 30 }),
  reference_id: uuid('reference_id'),
  product_id: uuid('product_id').references(() => products.id),
  warehouse_id: uuid('warehouse_id').references(() => warehouses.id),
  ...timestamps,
})

export const notificationRecipients = pgTable('notification_recipients', {
  id: uuid('id').primaryKey().defaultRandom(),
  notification_id: uuid('notification_id').notNull().references(() => notifications.id),
  user_id: uuid('user_id').notNull().references(() => users.id),
  is_read: boolean('is_read').notNull().default(false),
  read_at: timestamp('read_at'),
  ...timestamps,
})

export const notificationRules = pgTable('notification_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 30 }).notNull(),
  scope_type: varchar('scope_type', { length: 20 }).notNull(),
  scope_id: uuid('scope_id'),
  is_active: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const notificationRuleTargets = pgTable('notification_rule_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  rule_id: uuid('rule_id').notNull().references(() => notificationRules.id),
  target_type: varchar('target_type', { length: 10 }).notNull(),
  target_id: uuid('target_id').notNull(),
  ...timestamps,
})

export const notificationSettings = pgTable('notification_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 30 }).notNull(),
  is_enabled: boolean('is_enabled').notNull().default(true),
  delivery_method: varchar('delivery_method', { length: 10 }).notNull().default('both'),
  ...timestamps,
})

// ============================================================
// §5.2 Purchase
// ============================================================

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_po: varchar('no_po', { length: 50 }).notNull().unique(),
  supplier_id: uuid('supplier_id').notNull().references(() => suppliers.id),
  warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
  order_date: date('order_date').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  created_by: uuid('created_by').notNull().references(() => users.id),
  ...timestamps,
})

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  po_id: uuid('po_id').notNull().references(() => purchaseOrders.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  qty_order: decimal('qty_order', { precision: 18, scale: 4 }).notNull(),
  unit_price: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  qty_received: decimal('qty_received', { precision: 18, scale: 4 }).notNull().default('0'),
  ...timestamps,
})

export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_shipment: varchar('no_shipment', { length: 50 }).notNull().unique(),
  expedition_id: uuid('expedition_id').notNull().references(() => expeditions.id),
  ship_date: date('ship_date').notNull(),
  total_shipping_cost: decimal('total_shipping_cost', { precision: 18, scale: 2 }).notNull(),
  allocation_method: varchar('allocation_method', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  ...timestamps,
})

export const shipmentPoRef = pgTable('shipment_po_ref', {
  id: uuid('id').primaryKey().defaultRandom(),
  shipment_id: uuid('shipment_id').notNull().references(() => shipments.id),
  po_id: uuid('po_id').notNull().references(() => purchaseOrders.id),
  ...timestamps,
})

export const shipmentItems = pgTable('shipment_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  shipment_id: uuid('shipment_id').notNull().references(() => shipments.id),
  po_item_id: uuid('po_item_id').notNull().references(() => purchaseOrderItems.id),
  qty_shipped: decimal('qty_shipped', { precision: 18, scale: 4 }).notNull(),
  weight: decimal('weight', { precision: 18, scale: 4 }),
  allocated_shipping_cost_per_unit: decimal('allocated_shipping_cost_per_unit', { precision: 18, scale: 4 }),
  ...timestamps,
})

export const receivings = pgTable('receivings', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_receiving: varchar('no_receiving', { length: 50 }).notNull().unique(),
  shipment_id: uuid('shipment_id').notNull().references(() => shipments.id),
  warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
  receive_date: date('receive_date').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  created_by: uuid('created_by').notNull().references(() => users.id),
  ...timestamps,
})

export const receivingItems = pgTable('receiving_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiving_id: uuid('receiving_id').notNull().references(() => receivings.id),
  shipment_item_id: uuid('shipment_item_id').notNull().references(() => shipmentItems.id),
  po_item_id: uuid('po_item_id').notNull().references(() => purchaseOrderItems.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  qty_received: decimal('qty_received', { precision: 18, scale: 4 }).notNull(),
  unit_price: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  shipping_cost_per_unit: decimal('shipping_cost_per_unit', { precision: 18, scale: 4 }).notNull(),
  hpp: decimal('hpp', { precision: 18, scale: 4 }).notNull(),
  stock_layer_id: uuid('stock_layer_id'),
  ...timestamps,
})

// ============================================================
// §5.4 Stock (Core FIFO Engine)
// ============================================================

export const stockLayers = pgTable(
  'stock_layers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id').notNull().references(() => products.id),
    warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
    source_type: varchar('source_type', { length: 20 }).notNull(),
    source_id: uuid('source_id').notNull(),
    receive_date: date('receive_date').notNull(),
    qty_original: decimal('qty_original', { precision: 18, scale: 4 }).notNull(),
    qty_remaining: decimal('qty_remaining', { precision: 18, scale: 4 }).notNull(),
    hpp: decimal('hpp', { precision: 18, scale: 4 }).notNull(),
    status: varchar('status', { length: 10 }).notNull().default('active'),
    ...timestamps,
  },
  (table) => [
    index('stock_layers_product_warehouse_status_receivedate_idx').on(
      table.product_id,
      table.warehouse_id,
      table.status,
      table.receive_date,
    ),
  ],
)

// NOTE: stock_ledger is created as a PostgreSQL native RANGE-partitioned table
// (PARTITION BY RANGE (transaction_date), per month) — see the hand-written
// partitioning statements appended to the generated migration file. The
// primary key must include the partition column, hence the composite PK below.
export const stockLedger = pgTable(
  'stock_ledger',
  {
    id: uuid('id').defaultRandom().notNull(),
    product_id: uuid('product_id').notNull().references(() => products.id),
    warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
    transaction_type: varchar('transaction_type', { length: 30 }).notNull(),
    reference_type: varchar('reference_type', { length: 30 }).notNull(),
    reference_id: uuid('reference_id').notNull(),
    reference_no: varchar('reference_no', { length: 50 }),
    transaction_date: timestamp('transaction_date').notNull(),
    qty_in: decimal('qty_in', { precision: 18, scale: 4 }).notNull().default('0'),
    qty_out: decimal('qty_out', { precision: 18, scale: 4 }).notNull().default('0'),
    hpp_used: decimal('hpp_used', { precision: 18, scale: 4 }),
    running_balance_qty: decimal('running_balance_qty', { precision: 18, scale: 4 }).notNull(),
    running_balance_value: decimal('running_balance_value', { precision: 18, scale: 4 }).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.id, table.transaction_date] }),
    index('stock_ledger_product_warehouse_txndate_idx').on(
      table.product_id,
      table.warehouse_id,
      table.transaction_date,
    ),
    index('stock_ledger_reference_idx').on(table.reference_type, table.reference_id),
  ],
)

export const stockSummary = pgTable(
  'stock_summary',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id').notNull().references(() => products.id),
    warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
    qty_on_hand: decimal('qty_on_hand', { precision: 18, scale: 4 }).notNull().default('0'),
    qty_reserved: decimal('qty_reserved', { precision: 18, scale: 4 }).notNull().default('0'),
    qty_available: decimal('qty_available', { precision: 18, scale: 4 }).notNull().default('0'),
    total_value: decimal('total_value', { precision: 18, scale: 4 }).notNull().default('0'),
    ...timestamps,
  },
  (table) => [unique('stock_summary_product_warehouse_unique').on(table.product_id, table.warehouse_id)],
)

// ============================================================
// §5.2 Purchase Return
// ============================================================

export const purchaseReturns = pgTable('purchase_returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_return: varchar('no_return', { length: 50 }).notNull().unique(),
  receiving_id: uuid('receiving_id').notNull().references(() => receivings.id),
  warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
  return_date: date('return_date').notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  ...timestamps,
})

export const purchaseReturnItems = pgTable('purchase_return_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  return_id: uuid('return_id').notNull().references(() => purchaseReturns.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  stock_layer_id: uuid('stock_layer_id').notNull().references(() => stockLayers.id),
  qty_return: decimal('qty_return', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
})

// ============================================================
// §5.4 Stock Transfer & Adjustment
// ============================================================

export const stockTransfers = pgTable('stock_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_transfer: varchar('no_transfer', { length: 50 }).notNull().unique(),
  from_warehouse_id: uuid('from_warehouse_id').notNull().references(() => warehouses.id),
  to_warehouse_id: uuid('to_warehouse_id').notNull().references(() => warehouses.id),
  transfer_date: date('transfer_date').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  ...timestamps,
})

export const stockTransferItems = pgTable('stock_transfer_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transfer_id: uuid('transfer_id').notNull().references(() => stockTransfers.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  stock_layer_id: uuid('stock_layer_id').notNull().references(() => stockLayers.id),
  qty: decimal('qty', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
})

export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_adjustment: varchar('no_adjustment', { length: 50 }).notNull().unique(),
  warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
  adjustment_date: date('adjustment_date').notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  ...timestamps,
})

export const stockAdjustmentItems = pgTable('stock_adjustment_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  adjustment_id: uuid('adjustment_id').notNull().references(() => stockAdjustments.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  qty_diff: decimal('qty_diff', { precision: 18, scale: 4 }).notNull(),
  hpp: decimal('hpp', { precision: 18, scale: 4 }),
  ...timestamps,
})

// ============================================================
// §5.3 Sale
// ============================================================

export const saleOrders = pgTable('sale_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_so: varchar('no_so', { length: 50 }).notNull().unique(),
  customer_id: uuid('customer_id').notNull().references(() => customers.id),
  warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
  order_date: date('order_date').notNull(),
  use_do: boolean('use_do').notNull().default(false),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  created_by: uuid('created_by').notNull().references(() => users.id),
  ...timestamps,
})

export const saleOrderItems = pgTable('sale_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  so_id: uuid('so_id').notNull().references(() => saleOrders.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  qty_order: decimal('qty_order', { precision: 18, scale: 4 }).notNull(),
  sell_price: decimal('sell_price', { precision: 18, scale: 2 }).notNull(),
  qty_delivered: decimal('qty_delivered', { precision: 18, scale: 4 }).notNull().default('0'),
  ...timestamps,
})

export const deliveryOrders = pgTable('delivery_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_do: varchar('no_do', { length: 50 }).notNull().unique(),
  so_id: uuid('so_id').notNull().references(() => saleOrders.id),
  warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
  delivery_date: date('delivery_date').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  ...timestamps,
})

export const deliveryOrderItems = pgTable('delivery_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  do_id: uuid('do_id').notNull().references(() => deliveryOrders.id),
  so_item_id: uuid('so_item_id').notNull().references(() => saleOrderItems.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  qty_delivered: decimal('qty_delivered', { precision: 18, scale: 4 }).notNull(),
  cogs_per_unit: decimal('cogs_per_unit', { precision: 18, scale: 4 }),
  ...timestamps,
})

export const saleReturns = pgTable('sale_returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  no_return: varchar('no_return', { length: 50 }).notNull().unique(),
  source_type: varchar('source_type', { length: 10 }).notNull(),
  source_id: uuid('source_id').notNull(),
  return_date: date('return_date').notNull(),
  condition: varchar('condition', { length: 10 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  ...timestamps,
})

export const saleReturnItems = pgTable('sale_return_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  return_id: uuid('return_id').notNull().references(() => saleReturns.id),
  product_id: uuid('product_id').notNull().references(() => products.id),
  qty_return: decimal('qty_return', { precision: 18, scale: 4 }).notNull(),
  restore_hpp: decimal('restore_hpp', { precision: 18, scale: 4 }),
  ...timestamps,
})

// ============================================================
// §5.5 Analytics (Computed)
// ============================================================

export const productMovementStats = pgTable(
  'product_movement_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id').notNull().references(() => products.id),
    warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
    avg_daily_out_qty_30d: decimal('avg_daily_out_qty_30d', { precision: 18, scale: 4 }),
    avg_daily_out_qty_90d: decimal('avg_daily_out_qty_90d', { precision: 18, scale: 4 }),
    last_movement_date: date('last_movement_date'),
    days_since_last_movement: integer('days_since_last_movement'),
    calculated_at: timestamp('calculated_at'),
    ...timestamps,
  },
  (table) => [
    // Recomputed in place every run (a pure snapshot, not an accumulating
    // log) — the job upserts on this key so re-running it is idempotent.
    unique('product_movement_stats_product_warehouse_unique').on(table.product_id, table.warehouse_id),
  ],
)

export const movementClassification = pgTable(
  'movement_classification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id').notNull().references(() => products.id),
    warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
    classification: varchar('classification', { length: 10 }).notNull(),
    calculated_at: timestamp('calculated_at'),
    ...timestamps,
  },
  (table) => [
    unique('movement_classification_product_warehouse_unique').on(table.product_id, table.warehouse_id),
  ],
)

// §5.4 stock_valuation_snapshot — populated by the Fase 8
// stock-valuation-snapshot.job.ts (daily), read by
// /api/v1/reports/inventory-valuation.
export const stockValuationSnapshot = pgTable(
  'stock_valuation_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    snapshot_date: date('snapshot_date').notNull(),
    product_id: uuid('product_id').notNull().references(() => products.id),
    warehouse_id: uuid('warehouse_id').notNull().references(() => warehouses.id),
    qty_on_hand: decimal('qty_on_hand', { precision: 18, scale: 4 }).notNull(),
    total_value: decimal('total_value', { precision: 18, scale: 4 }).notNull(),
    ...timestamps,
  },
  (table) => [
    unique('stock_valuation_snapshot_date_product_warehouse_unique').on(
      table.snapshot_date,
      table.product_id,
      table.warehouse_id,
    ),
  ],
)
