import { and, eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { saleReturns, saleReturnItems, saleOrderItems, deliveryOrderItems, stockLedger } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_return: saleReturns.no_return,
  return_date: saleReturns.return_date,
  status: saleReturns.status,
}

export function listReturns() {
  return db.select().from(saleReturns)
}

export function listReturnsPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string; status?: string; condition?: string },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: saleReturns.status, value: opts.status })
  if (opts.condition) extraFilters.push({ column: saleReturns.condition, value: opts.condition })
  return listPaged(saleReturns, {
    ...opts,
    searchColumns: [saleReturns.no_return],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || saleReturns.return_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
  })
}

export function findReturn(id: string) {
  return db.query.saleReturns.findFirst({ where: eq(saleReturns.id, id) })
}

export function createReturn(
  values: {
    id?: string
    no_return: string
    source_type: string
    source_id: string
    return_date: string
    condition: string
    status?: string
  },
  executor: typeof db | Tx = db,
) {
  return executor.insert(saleReturns).values(values).returning()
}

export function updateReturn(id: string, values: Record<string, unknown>) {
  return db
    .update(saleReturns)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(saleReturns.id, id))
    .returning()
}

export function updateReturnTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(saleReturns)
    .set({ ...values, updated_at: new Date() })
    .where(eq(saleReturns.id, id))
    .returning()
}

export function listReturnItems(returnId: string) {
  return db.select().from(saleReturnItems).where(eq(saleReturnItems.return_id, returnId))
}

export function createReturnItem(
  values: {
    return_id: string
    product_id: string
    qty_return: string
    restore_hpp: string | null
  },
  executor: typeof db | Tx = db,
) {
  return executor.insert(saleReturnItems).values(values).returning()
}

// restore_hpp resolution (§4.2 / §6.4 note: "restore stock dengan HPP asal,
// bukan average sekarang"): for a DO-sourced return, cogs_per_unit is
// already stored directly on the delivery_order_items row. For an SO-sourced
// return (the use_do=false path, where the SO confirm itself called
// consumeStock), the cost was recorded as stock_ledger.hpp_used on the
// 'delivery' entry consumeStock posted at confirm time.
export async function findDoItemCogs(doId: string, productId: string) {
  const row = await db.query.deliveryOrderItems.findFirst({
    where: and(eq(deliveryOrderItems.do_id, doId), eq(deliveryOrderItems.product_id, productId)),
  })
  return row?.cogs_per_unit ?? null
}

export async function findSoConsumptionHpp(soId: string, productId: string) {
  const row = await db.query.stockLedger.findFirst({
    where: and(
      eq(stockLedger.reference_type, 'so'),
      eq(stockLedger.reference_id, soId),
      eq(stockLedger.product_id, productId),
      eq(stockLedger.transaction_type, 'delivery'),
    ),
  })
  return row?.hpp_used ?? null
}

export async function findSoItemByProduct(soId: string, productId: string) {
  return db.query.saleOrderItems.findFirst({
    where: and(eq(saleOrderItems.so_id, soId), eq(saleOrderItems.product_id, productId)),
  })
}

export async function findDoItemByProduct(doId: string, productId: string) {
  return db.query.deliveryOrderItems.findFirst({
    where: and(eq(deliveryOrderItems.do_id, doId), eq(deliveryOrderItems.product_id, productId)),
  })
}

// Sums qty_return already recorded against this source+product across every
// prior sale_return (good AND damaged both consume the return "budget" —
// once goods are marked returned, whether they're resellable or not, they
// can't be returned again). Read inside the caller's transaction, after
// locking the source (so/do) row, so a concurrent return against the same
// source can't race this check.
export async function sumReturnedQty(tx: Tx, sourceType: string, sourceId: string, productId: string) {
  const rows = await tx
    .select({ qty_return: saleReturnItems.qty_return })
    .from(saleReturnItems)
    .innerJoin(saleReturns, eq(saleReturnItems.return_id, saleReturns.id))
    .where(
      and(
        eq(saleReturns.source_type, sourceType),
        eq(saleReturns.source_id, sourceId),
        eq(saleReturnItems.product_id, productId),
      ),
    )
  return rows.reduce((sum, r) => sum + Number(r.qty_return), 0)
}
