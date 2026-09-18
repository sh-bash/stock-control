import { eq, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { purchaseOrders, purchaseOrderItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_po: purchaseOrders.no_po,
  order_date: purchaseOrders.order_date,
  status: purchaseOrders.status,
}

export function listOrders() {
  return db.select().from(purchaseOrders)
}

export function listOrdersPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & {
    sortBy?: string
    status?: string | string[]
    warehouseId?: string
    supplierId?: string
  },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: purchaseOrders.status, value: opts.status })
  if (opts.warehouseId) extraFilters.push({ column: purchaseOrders.warehouse_id, value: opts.warehouseId })
  if (opts.supplierId) extraFilters.push({ column: purchaseOrders.supplier_id, value: opts.supplierId })
  return listPaged(purchaseOrders, {
    ...opts,
    searchColumns: [purchaseOrders.no_po],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || purchaseOrders.order_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    dateColumn: purchaseOrders.order_date,
  })
}

export function findOrder(id: string) {
  return db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) })
}

export function createOrder(values: {
  no_po: string
  supplier_id: string
  warehouse_id: string
  order_date: string
  created_by: string
  status?: string
}) {
  return db.insert(purchaseOrders).values(values).returning()
}

export function updateOrder(id: string, values: Record<string, unknown>) {
  return db
    .update(purchaseOrders)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(purchaseOrders.id, id))
    .returning()
}

export function updateOrderTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(purchaseOrders)
    .set({ ...values, updated_at: new Date() })
    .where(eq(purchaseOrders.id, id))
    .returning()
}

export function deleteOrder(id: string) {
  return db.delete(purchaseOrders).where(eq(purchaseOrders.id, id)).returning()
}

export function listItems(poId: string) {
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.po_id, poId))
}

export function findItem(id: string) {
  return db.query.purchaseOrderItems.findFirst({ where: eq(purchaseOrderItems.id, id) })
}

export function createItem(values: {
  po_id: string
  product_id: string
  qty_order: string
  unit_price: string
}) {
  return db.insert(purchaseOrderItems).values(values).returning()
}

export function deleteItem(id: string) {
  return db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id)).returning()
}

// Runs inside the caller's transaction so the qty_received accumulation is
// part of the same atomic unit as the stock layer / ledger / summary writes.
export function incrementQtyReceived(tx: Tx, itemId: string, qty: number) {
  return tx
    .update(purchaseOrderItems)
    .set({ qty_received: sql`${purchaseOrderItems.qty_received} + ${qty}`, updated_at: new Date() })
    .where(eq(purchaseOrderItems.id, itemId))
    .returning()
}
