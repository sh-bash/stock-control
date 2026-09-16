import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { globalStockSettings, productStockSettings } from '../db/schema'

export function listSettings() {
  return db.select().from(productStockSettings)
}

export function findSetting(id: string) {
  return db.query.productStockSettings.findFirst({ where: eq(productStockSettings.id, id) })
}

export function createSetting(values: {
  product_id: string
  warehouse_id?: string | null
  min_stock?: string | null
  reorder_point?: string | null
  reorder_qty?: string | null
  fast_moving_min_daily_out?: string | null
  slow_moving_max_daily_out?: string | null
  aging_warning_days?: number | null
  aging_danger_days?: number | null
  is_active?: boolean
}) {
  return db.insert(productStockSettings).values(values).returning()
}

export function updateSetting(id: string, values: Record<string, unknown>) {
  return db
    .update(productStockSettings)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(productStockSettings.id, id))
    .returning()
}

export function deleteSetting(id: string) {
  return db.delete(productStockSettings).where(eq(productStockSettings.id, id)).returning()
}

export function getGlobalSettings() {
  return db.query.globalStockSettings.findFirst()
}

export interface EffectiveStockSettings {
  min_stock: string | null
  reorder_point: string | null
  reorder_qty: string | null
  fast_moving_min_daily_out: string
  slow_moving_max_daily_out: string
  aging_warning_days: number
  aging_danger_days: number
  dead_stock_no_movement_days: number
}

// Resolution is per-FIELD, not per-row (PRD §5.1: "nullable = pakai global"
// on each individual column of product_stock_settings). Precedence for each
// field independently: the exact product+warehouse override row, then the
// product-level row (warehouse_id IS NULL, applies to every warehouse for
// that product), then global_stock_settings. A product could have a
// warehouse-specific row that only sets min_stock while everything else —
// including reorder_point — still falls through to the product-level row
// or global.
export async function resolveEffectiveSettings(
  productId: string,
  warehouseId: string,
): Promise<EffectiveStockSettings | null> {
  const [specific, productLevel, global] = await Promise.all([
    db.query.productStockSettings.findFirst({
      where: and(
        eq(productStockSettings.product_id, productId),
        eq(productStockSettings.warehouse_id, warehouseId),
        eq(productStockSettings.is_active, true),
      ),
    }),
    db.query.productStockSettings.findFirst({
      where: and(
        eq(productStockSettings.product_id, productId),
        isNull(productStockSettings.warehouse_id),
        eq(productStockSettings.is_active, true),
      ),
    }),
    getGlobalSettings(),
  ])

  if (!global) return null

  const pick = <K extends keyof typeof productStockSettings.$inferSelect>(field: K) =>
    specific?.[field] ?? productLevel?.[field] ?? null

  return {
    min_stock: pick('min_stock'),
    reorder_point: pick('reorder_point'),
    reorder_qty: pick('reorder_qty'),
    fast_moving_min_daily_out: pick('fast_moving_min_daily_out') ?? global.fast_moving_min_daily_out,
    slow_moving_max_daily_out: pick('slow_moving_max_daily_out') ?? global.slow_moving_max_daily_out,
    aging_warning_days: pick('aging_warning_days') ?? global.aging_warning_days,
    aging_danger_days: pick('aging_danger_days') ?? global.aging_danger_days,
    dead_stock_no_movement_days: global.dead_stock_no_movement_days,
  }
}
