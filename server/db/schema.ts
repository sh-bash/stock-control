import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
} from 'drizzle-orm/pg-core'

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

export const productStockSettings = pgTable('product_stock_settings', {
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
})

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
