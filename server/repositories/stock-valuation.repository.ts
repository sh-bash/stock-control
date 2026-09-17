import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { stockLayers, stockValuationSnapshot } from '../db/schema'

// Same ground-truth aggregation as rebuildStockSummary/stock-reconciliation:
// SUM(qty_remaining) / SUM(qty_remaining*hpp) per product+warehouse, straight
// from stock_layers — the snapshot always reflects the FIFO layers actually
// on hand on the day it's taken, not stock_summary (which should agree, but
// the layers are the source of truth).
export function aggregateCurrentStockByProductWarehouse() {
  return db
    .select({
      product_id: stockLayers.product_id,
      warehouse_id: stockLayers.warehouse_id,
      qty_on_hand: sql<string>`COALESCE(SUM(${stockLayers.qty_remaining}), 0)`,
      total_value: sql<string>`COALESCE(SUM(${stockLayers.qty_remaining} * ${stockLayers.hpp}), 0)`,
    })
    .from(stockLayers)
    .groupBy(stockLayers.product_id, stockLayers.warehouse_id)
}

// Upsert on the (snapshot_date, product_id, warehouse_id) unique key —
// running the job twice for the same day overwrites with the same
// recomputed values instead of creating a duplicate row, which is what
// makes it idempotent.
export async function upsertSnapshot(values: {
  snapshot_date: string
  product_id: string
  warehouse_id: string
  qty_on_hand: string
  total_value: string
}) {
  const rows = await db
    .insert(stockValuationSnapshot)
    .values(values)
    .onConflictDoUpdate({
      target: [
        stockValuationSnapshot.snapshot_date,
        stockValuationSnapshot.product_id,
        stockValuationSnapshot.warehouse_id,
      ],
      set: {
        qty_on_hand: values.qty_on_hand,
        total_value: values.total_value,
        updated_at: new Date(),
      },
    })
    .returning()
  return rows[0]
}

export function listSnapshots(filters: {
  productId?: string
  warehouseId?: string
  dateFrom?: string
  dateTo?: string
}) {
  const conditions = []
  if (filters.productId) conditions.push(eq(stockValuationSnapshot.product_id, filters.productId))
  if (filters.warehouseId) conditions.push(eq(stockValuationSnapshot.warehouse_id, filters.warehouseId))
  if (filters.dateFrom) conditions.push(gte(stockValuationSnapshot.snapshot_date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(stockValuationSnapshot.snapshot_date, filters.dateTo))

  const query = db.select().from(stockValuationSnapshot)
  return conditions.length > 0 ? query.where(and(...conditions)) : query
}

export function findLatestSnapshotDate() {
  return db
    .select({ max: sql<string | null>`MAX(${stockValuationSnapshot.snapshot_date})` })
    .from(stockValuationSnapshot)
}
