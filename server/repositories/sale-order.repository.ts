import { eq, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { saleOrders, saleOrderItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_so: saleOrders.no_so,
  order_date: saleOrders.order_date,
  status: saleOrders.status,
}

export function listOrders() {
  return db.select().from(saleOrders)
}

export function listOrdersPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & {
    sortBy?: string
    status?: string | string[]
    warehouseId?: string
    customerId?: string
    useDo?: string
  },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: saleOrders.status, value: opts.status })
  if (opts.warehouseId) extraFilters.push({ column: saleOrders.warehouse_id, value: opts.warehouseId })
  if (opts.customerId) extraFilters.push({ column: saleOrders.customer_id, value: opts.customerId })
  if (opts.useDo === 'true' || opts.useDo === 'false') {
    extraFilters.push({ column: saleOrders.use_do, value: opts.useDo === 'true' })
  }
  return listPaged(saleOrders, {
    ...opts,
    searchColumns: [saleOrders.no_so],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || saleOrders.order_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    dateColumn: saleOrders.order_date,
  })
}

export function findOrder(id: string) {
  return db.query.saleOrders.findFirst({ where: eq(saleOrders.id, id) })
}

// Row-locks the SO for the duration of the caller's transaction — used to
// serialize concurrent sale returns against the same SO (see
// sale-return.service.ts) so their "how much has already been returned"
// check can't race.
export async function getOrderForUpdate(tx: Tx, id: string) {
  const rows = await tx.select().from(saleOrders).where(eq(saleOrders.id, id)).for('update')
  return rows[0] ?? null
}

export function createOrder(values: {
  no_so: string
  customer_id: string
  warehouse_id: string
  order_date: string
  use_do: boolean
  created_by: string
  status?: string
}) {
  return db.insert(saleOrders).values(values).returning()
}

export function updateOrder(id: string, values: Record<string, unknown>) {
  return db
    .update(saleOrders)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(saleOrders.id, id))
    .returning()
}

export function updateOrderTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(saleOrders)
    .set({ ...values, updated_at: new Date() })
    .where(eq(saleOrders.id, id))
    .returning()
}

export function listItems(soId: string) {
  return db.select().from(saleOrderItems).where(eq(saleOrderItems.so_id, soId))
}

export function findItem(id: string) {
  return db.query.saleOrderItems.findFirst({ where: eq(saleOrderItems.id, id) })
}

export function createItem(values: {
  so_id: string
  product_id: string
  qty_order: string
  sell_price: string
}) {
  return db.insert(saleOrderItems).values(values).returning()
}

// Runs inside the caller's transaction so the qty_delivered accumulation is
// part of the same atomic unit as the delivery order's stock writes.
export function incrementQtyDelivered(tx: Tx, itemId: string, qty: number) {
  return tx
    .update(saleOrderItems)
    .set({ qty_delivered: sql`${saleOrderItems.qty_delivered} + ${qty}`, updated_at: new Date() })
    .where(eq(saleOrderItems.id, itemId))
    .returning()
}
