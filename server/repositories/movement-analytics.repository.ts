import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { productMovementStats, movementClassification, stockLedger, stockSummary } from '../db/schema'

export function listStockSummaryCombinations() {
  return db
    .select({ product_id: stockSummary.product_id, warehouse_id: stockSummary.warehouse_id })
    .from(stockSummary)
}

// SUM(qty_out) over the trailing N days divided by N — a fixed-window daily
// velocity, so a product that stops selling naturally decays toward 0 as the
// window rolls forward, per §6.5.
export async function sumQtyOutSince(productId: string, warehouseId: string, sinceDate: Date) {
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(${stockLedger.qty_out}), 0)` })
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.product_id, productId),
        eq(stockLedger.warehouse_id, warehouseId),
        sql`${stockLedger.transaction_date} >= ${sinceDate.toISOString()}`,
      ),
    )
  return Number(rows[0]?.total ?? 0)
}

export async function findLastOutboundDate(productId: string, warehouseId: string) {
  const rows = await db
    .select({ last: sql<string | null>`MAX(${stockLedger.transaction_date})` })
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.product_id, productId),
        eq(stockLedger.warehouse_id, warehouseId),
        sql`${stockLedger.qty_out} > 0`,
      ),
    )
  return rows[0]?.last ?? null
}

export async function findFirstLedgerDate(productId: string, warehouseId: string) {
  const rows = await db
    .select({ first: sql<string | null>`MIN(${stockLedger.transaction_date})` })
    .from(stockLedger)
    .where(and(eq(stockLedger.product_id, productId), eq(stockLedger.warehouse_id, warehouseId)))
  return rows[0]?.first ?? null
}

export async function upsertMovementStats(values: {
  product_id: string
  warehouse_id: string
  avg_daily_out_qty_30d: string
  avg_daily_out_qty_90d: string
  last_movement_date: string | null
  days_since_last_movement: number | null
  calculated_at: Date
}) {
  const rows = await db
    .insert(productMovementStats)
    .values(values)
    .onConflictDoUpdate({
      target: [productMovementStats.product_id, productMovementStats.warehouse_id],
      set: {
        avg_daily_out_qty_30d: values.avg_daily_out_qty_30d,
        avg_daily_out_qty_90d: values.avg_daily_out_qty_90d,
        last_movement_date: values.last_movement_date,
        days_since_last_movement: values.days_since_last_movement,
        calculated_at: values.calculated_at,
        updated_at: new Date(),
      },
    })
    .returning()
  return rows[0]
}

export async function upsertMovementClassification(values: {
  product_id: string
  warehouse_id: string
  classification: string
  calculated_at: Date
}) {
  const rows = await db
    .insert(movementClassification)
    .values(values)
    .onConflictDoUpdate({
      target: [movementClassification.product_id, movementClassification.warehouse_id],
      set: {
        classification: values.classification,
        calculated_at: values.calculated_at,
        updated_at: new Date(),
      },
    })
    .returning()
  return rows[0]
}

export function listMovementClassifications() {
  return db.select().from(movementClassification)
}

export function listMovementStats() {
  return db.select().from(productMovementStats)
}
