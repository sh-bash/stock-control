import { and, eq, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { stockLayers, stockLedger, stockSummary } from '../db/schema'

type Tx = PgTransaction<any, any, any>

export function createStockLayer(
  tx: Tx,
  values: {
    product_id: string
    warehouse_id: string
    source_type: string
    source_id: string
    receive_date: string
    qty_original: string
    qty_remaining: string
    hpp: string
  },
) {
  return tx.insert(stockLayers).values(values).returning()
}

// Single atomic INSERT ... ON CONFLICT DO UPDATE instead of a check-then-act
// (SELECT then INSERT-or-UPDATE) pattern. The latter has a race window when
// no row exists yet for a product+warehouse: two concurrent receivings can
// both see "no row", both attempt INSERT, and the loser hits a unique
// violation and rolls back its entire transaction (layer + ledger + this
// update), silently dropping that receiving. The upsert lets Postgres
// serialize on the unique index (product_id, warehouse_id) itself — the
// second transaction blocks until the first commits, then applies its
// increment on top, so no receiving is ever lost.
export async function upsertStockSummaryOnReceive(
  tx: Tx,
  params: { product_id: string; warehouse_id: string; qty: string; value: string },
) {
  const rows = await tx
    .insert(stockSummary)
    .values({
      product_id: params.product_id,
      warehouse_id: params.warehouse_id,
      qty_on_hand: params.qty,
      qty_reserved: '0',
      qty_available: params.qty,
      total_value: params.value,
    })
    .onConflictDoUpdate({
      target: [stockSummary.product_id, stockSummary.warehouse_id],
      set: {
        qty_on_hand: sql`${stockSummary.qty_on_hand} + excluded.qty_on_hand`,
        total_value: sql`${stockSummary.total_value} + excluded.total_value`,
        qty_available: sql`(${stockSummary.qty_on_hand} + excluded.qty_on_hand) - ${stockSummary.qty_reserved}`,
        updated_at: new Date(),
      },
    })
    .returning()
  return rows[0]
}

export function insertLedgerEntry(
  tx: Tx,
  values: {
    product_id: string
    warehouse_id: string
    transaction_type: string
    reference_type: string
    reference_id: string
    reference_no?: string | null
    transaction_date: Date
    qty_in?: string
    qty_out?: string
    hpp_used?: string | null
    running_balance_qty: string
    running_balance_value: string
  },
) {
  return tx.insert(stockLedger).values(values).returning()
}

export function listStockSummary() {
  return db.select().from(stockSummary)
}

export function listStockLayers(productId?: string, warehouseId?: string) {
  const conditions = []
  if (productId) conditions.push(eq(stockLayers.product_id, productId))
  if (warehouseId) conditions.push(eq(stockLayers.warehouse_id, warehouseId))
  const query = db.select().from(stockLayers)
  return conditions.length > 0 ? query.where(and(...conditions)) : query
}

export function listStockLedger(productId?: string, warehouseId?: string) {
  const conditions = []
  if (productId) conditions.push(eq(stockLedger.product_id, productId))
  if (warehouseId) conditions.push(eq(stockLedger.warehouse_id, warehouseId))
  const query = db.select().from(stockLedger)
  return conditions.length > 0 ? query.where(and(...conditions)) : query
}
