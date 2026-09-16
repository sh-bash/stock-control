import { and, asc, eq, gt, gte, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { stockLayers, stockLedger, stockSummary } from '../db/schema'
import { failure } from '../utils/response'

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

// Row-locks a single stock_layer for a targeted decrement (purchase return
// against a specific receiving layer, or the source side of a transfer).
export async function getLayerForUpdate(tx: Tx, layerId: string) {
  const rows = await tx.select().from(stockLayers).where(eq(stockLayers.id, layerId)).for('update')
  return rows[0] ?? null
}

export function decrementLayerQty(tx: Tx, layerId: string, newRemaining: string) {
  return tx
    .update(stockLayers)
    .set({
      qty_remaining: newRemaining,
      status: Number(newRemaining) <= 0 ? 'exhausted' : 'active',
      updated_at: new Date(),
    })
    .where(eq(stockLayers.id, layerId))
    .returning()
}

// Atomic guarded decrement: the WHERE qty_on_hand >= qty check and the
// subtraction happen in the same UPDATE statement, so there is no
// read-then-write gap for a concurrent decrement to race through. If the
// row doesn't have enough qty (or doesn't exist), zero rows are updated and
// the caller gets a clear INSUFFICIENT_STOCK error instead of a negative
// balance.
export async function decrementStockSummaryGuarded(
  tx: Tx,
  params: { product_id: string; warehouse_id: string; qty: string; value: string },
) {
  const rows = await tx
    .update(stockSummary)
    .set({
      qty_on_hand: sql`${stockSummary.qty_on_hand} - ${params.qty}`,
      total_value: sql`${stockSummary.total_value} - ${params.value}`,
      qty_available: sql`(${stockSummary.qty_on_hand} - ${params.qty}) - ${stockSummary.qty_reserved}`,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(stockSummary.product_id, params.product_id),
        eq(stockSummary.warehouse_id, params.warehouse_id),
        gte(sql`${stockSummary.qty_on_hand} - ${params.qty}`, sql`0`),
      ),
    )
    .returning()

  if (!rows[0]) {
    return failure('Stock tidak cukup untuk transaksi ini', 'INSUFFICIENT_STOCK', 400)
  }
  return rows[0]
}

// FIFO consumption across active layers for a product+warehouse, used when
// the caller (negative stock_adjustment) does not reference a specific
// layer. Layers are locked with FOR UPDATE in receive_date order so
// concurrent consumers serialize on them instead of racing to read the same
// qty_remaining and over-subscribing it.
export async function consumeLayersFifo(tx: Tx, productId: string, warehouseId: string, qtyNeeded: number) {
  const layers = await tx
    .select()
    .from(stockLayers)
    .where(
      and(
        eq(stockLayers.product_id, productId),
        eq(stockLayers.warehouse_id, warehouseId),
        eq(stockLayers.status, 'active'),
        gt(stockLayers.qty_remaining, '0'),
      ),
    )
    .orderBy(asc(stockLayers.receive_date))
    .for('update')

  let remainingNeeded = qtyNeeded
  let totalCost = 0
  const consumptions: { layer_id: string; qty_taken: number; hpp: number }[] = []

  for (const layer of layers) {
    if (remainingNeeded <= 0) break
    const available = Number(layer.qty_remaining)
    const qtyTaken = Math.min(available, remainingNeeded)
    const newRemaining = (available - qtyTaken).toString()

    await decrementLayerQty(tx, layer.id, newRemaining)

    totalCost += qtyTaken * Number(layer.hpp)
    remainingNeeded -= qtyTaken
    consumptions.push({ layer_id: layer.id, qty_taken: qtyTaken, hpp: Number(layer.hpp) })
  }

  if (remainingNeeded > 0.00005) {
    return failure('Stock tidak cukup untuk transaksi ini', 'INSUFFICIENT_STOCK', 400)
  }

  return { totalCost, consumptions }
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
