import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { purchaseReturns, purchaseReturnItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_return: purchaseReturns.no_return,
  return_date: purchaseReturns.return_date,
  status: purchaseReturns.status,
}

export function listReturns() {
  return db.select().from(purchaseReturns)
}

export function listReturnsPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string; status?: string; warehouseId?: string },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: purchaseReturns.status, value: opts.status })
  if (opts.warehouseId) extraFilters.push({ column: purchaseReturns.warehouse_id, value: opts.warehouseId })
  return listPaged(purchaseReturns, {
    ...opts,
    searchColumns: [purchaseReturns.no_return],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || purchaseReturns.return_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
  })
}

export function findReturn(id: string) {
  return db.query.purchaseReturns.findFirst({ where: eq(purchaseReturns.id, id) })
}

export function createReturn(values: {
  no_return: string
  receiving_id: string
  warehouse_id: string
  return_date: string
  reason?: string | null
  status?: string
}) {
  return db.insert(purchaseReturns).values(values).returning()
}

export function updateReturn(id: string, values: Record<string, unknown>) {
  return db
    .update(purchaseReturns)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(purchaseReturns.id, id))
    .returning()
}

export function updateReturnTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(purchaseReturns)
    .set({ ...values, updated_at: new Date() })
    .where(eq(purchaseReturns.id, id))
    .returning()
}

export function listReturnItems(returnId: string) {
  return db.select().from(purchaseReturnItems).where(eq(purchaseReturnItems.return_id, returnId))
}

export function createReturnItem(values: {
  return_id: string
  product_id: string
  stock_layer_id: string
  qty_return: string
}) {
  return db.insert(purchaseReturnItems).values(values).returning()
}
