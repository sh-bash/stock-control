import { and, asc, eq, gt, gte, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { products, stockLayers, stockLedger, stockSummary } from '../db/schema'
import { failure } from '../utils/response'
import { listPaged, type PagedListOptions } from '../utils/crud'

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

// Reserves qty against a product+warehouse (§6.4: SO confirm with use_do)
// without touching qty_on_hand — same atomic upsert-on-conflict shape as
// upsertStockSummaryOnReceive, for the same reason: two concurrent SO
// confirms reserving against a brand-new product+warehouse must not race a
// check-then-insert.
export async function incrementReservedQty(
  tx: Tx,
  params: { product_id: string; warehouse_id: string; qty: string },
) {
  const rows = await tx
    .insert(stockSummary)
    .values({
      product_id: params.product_id,
      warehouse_id: params.warehouse_id,
      qty_on_hand: '0',
      qty_reserved: params.qty,
      qty_available: (-Number(params.qty)).toString(),
      total_value: '0',
    })
    .onConflictDoUpdate({
      target: [stockSummary.product_id, stockSummary.warehouse_id],
      set: {
        qty_reserved: sql`${stockSummary.qty_reserved} + excluded.qty_reserved`,
        qty_available: sql`${stockSummary.qty_on_hand} - (${stockSummary.qty_reserved} + excluded.qty_reserved)`,
        updated_at: new Date(),
      },
    })
    .returning()
  return rows[0]
}

// Atomic guarded decrement of qty_reserved (DO approved: the reservation
// made at SO confirm is released as the goods actually leave). Same
// WHERE-guarded-UPDATE shape as decrementStockSummaryGuarded so it can never
// drive qty_reserved negative under concurrent DOs against the same SO.
export async function decrementReservedQtyGuarded(
  tx: Tx,
  params: { product_id: string; warehouse_id: string; qty: string },
) {
  const rows = await tx
    .update(stockSummary)
    .set({
      qty_reserved: sql`${stockSummary.qty_reserved} - ${params.qty}`,
      qty_available: sql`${stockSummary.qty_on_hand} - (${stockSummary.qty_reserved} - ${params.qty})`,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(stockSummary.product_id, params.product_id),
        eq(stockSummary.warehouse_id, params.warehouse_id),
        gte(sql`${stockSummary.qty_reserved} - ${params.qty}`, sql`0`),
      ),
    )
    .returning()

  if (!rows[0]) {
    return failure('qty_reserved tidak cukup untuk dilepas sejumlah ini', 'INSUFFICIENT_RESERVED', 400)
  }
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

const SUMMARY_SORT_COLUMNS: Record<string, any> = {
  qty_on_hand: stockSummary.qty_on_hand,
  qty_reserved: stockSummary.qty_reserved,
  qty_available: stockSummary.qty_available,
  total_value: stockSummary.total_value,
}

// Resolves each row's effective reorder_point the same way the app's stock
// alerts do: a product+warehouse-specific override in product_stock_settings
// wins, falling back to that product's warehouse_id=NULL (global) row. Both
// subqueries are correlated on the existing (product_id, warehouse_id)
// columns, so they use the same index stockSummary itself is looked up by.
const REORDER_POINT_EXPR = sql`COALESCE(
  (SELECT pss.reorder_point FROM product_stock_settings pss WHERE pss.product_id = ${stockSummary.product_id} AND pss.warehouse_id = ${stockSummary.warehouse_id} LIMIT 1),
  (SELECT pss.reorder_point FROM product_stock_settings pss WHERE pss.product_id = ${stockSummary.product_id} AND pss.warehouse_id IS NULL LIMIT 1)
)`

export async function listStockSummaryPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & {
    sortBy?: string
    productId?: string
    warehouseId?: string
    categoryId?: string
    condition?: 'normal' | 'low' | 'out'
  },
) {
  const extraFilters = []
  if (opts.productId) extraFilters.push({ column: stockSummary.product_id, value: opts.productId })
  if (opts.warehouseId) extraFilters.push({ column: stockSummary.warehouse_id, value: opts.warehouseId })

  if (opts.categoryId) {
    const categoryProducts = await db.select({ id: products.id }).from(products).where(eq(products.category_id, opts.categoryId))
    extraFilters.push({ column: stockSummary.product_id, value: categoryProducts.map((p) => p.id) })
  }

  let rawCondition
  if (opts.condition === 'low') {
    rawCondition = sql`${stockSummary.qty_on_hand} > 0 AND ${REORDER_POINT_EXPR} IS NOT NULL AND ${stockSummary.qty_on_hand} <= ${REORDER_POINT_EXPR}`
  } else if (opts.condition === 'out') {
    rawCondition = sql`${stockSummary.qty_on_hand} = 0`
  } else if (opts.condition === 'normal') {
    rawCondition = sql`${stockSummary.qty_on_hand} > 0 AND (${REORDER_POINT_EXPR} IS NULL OR ${stockSummary.qty_on_hand} > ${REORDER_POINT_EXPR})`
  }

  return listPaged(stockSummary, {
    ...opts,
    sortColumn: (opts.sortBy && SUMMARY_SORT_COLUMNS[opts.sortBy]) || stockSummary.total_value,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    rawCondition,
  })
}

export function listStockLayers(productId?: string, warehouseId?: string) {
  const conditions = []
  if (productId) conditions.push(eq(stockLayers.product_id, productId))
  if (warehouseId) conditions.push(eq(stockLayers.warehouse_id, warehouseId))
  const query = db.select().from(stockLayers)
  return conditions.length > 0 ? query.where(and(...conditions)) : query
}

const LAYER_SORT_COLUMNS: Record<string, any> = {
  receive_date: stockLayers.receive_date,
  qty_original: stockLayers.qty_original,
  qty_remaining: stockLayers.qty_remaining,
  hpp: stockLayers.hpp,
  status: stockLayers.status,
}

export function listStockLayersPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string; productId?: string; warehouseId?: string; status?: string },
) {
  const extraFilters = []
  if (opts.productId) extraFilters.push({ column: stockLayers.product_id, value: opts.productId })
  if (opts.warehouseId) extraFilters.push({ column: stockLayers.warehouse_id, value: opts.warehouseId })
  if (opts.status) extraFilters.push({ column: stockLayers.status, value: opts.status })
  return listPaged(stockLayers, {
    ...opts,
    sortColumn: (opts.sortBy && LAYER_SORT_COLUMNS[opts.sortBy]) || stockLayers.receive_date,
    sortDir: opts.sortDir ?? 'asc',
    extraFilters,
  })
}

// Every currently-sellable layer, for the aging-check job to walk.
export function listActiveLayers() {
  return db.select().from(stockLayers).where(and(eq(stockLayers.status, 'active'), gt(stockLayers.qty_remaining, '0')))
}

export function listStockLedger(productId?: string, warehouseId?: string) {
  const conditions = []
  if (productId) conditions.push(eq(stockLedger.product_id, productId))
  if (warehouseId) conditions.push(eq(stockLedger.warehouse_id, warehouseId))
  const query = db.select().from(stockLedger)
  return conditions.length > 0 ? query.where(and(...conditions)) : query
}

const LEDGER_SORT_COLUMNS: Record<string, any> = {
  transaction_date: stockLedger.transaction_date,
  transaction_type: stockLedger.transaction_type,
  qty_in: stockLedger.qty_in,
  qty_out: stockLedger.qty_out,
}

// The one place in this app where server-side pagination is not optional —
// stock_ledger is append-only across the lifetime of the business and is
// the exact "could be millions of rows" case called out when this
// pagination pass was scoped. Filters straight onto the Fase 3 composite
// index (product_id, warehouse_id, transaction_date).
export function listStockLedgerPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn' | 'dateColumn'> & {
    sortBy?: string
    productId?: string
    warehouseId?: string
    transactionType?: string | string[]
  },
) {
  const extraFilters = []
  if (opts.productId) extraFilters.push({ column: stockLedger.product_id, value: opts.productId })
  if (opts.warehouseId) extraFilters.push({ column: stockLedger.warehouse_id, value: opts.warehouseId })
  if (opts.transactionType) extraFilters.push({ column: stockLedger.transaction_type, value: opts.transactionType })

  // stock_ledger is append-only and can grow unbounded — never let it run
  // without a date floor. Defaults to the last 30 days when the caller
  // (BaseDateRangePicker on the Stock Ledger page always sends one, but this
  // guards direct API callers too) doesn't supply date_from.
  const dateFrom = opts.dateFrom ?? new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return listPaged(stockLedger, {
    ...opts,
    dateFrom,
    sortColumn: (opts.sortBy && LEDGER_SORT_COLUMNS[opts.sortBy]) || stockLedger.transaction_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    dateColumn: stockLedger.transaction_date,
  })
}
