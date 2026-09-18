import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { deliveryOrders, deliveryOrderItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_do: deliveryOrders.no_do,
  delivery_date: deliveryOrders.delivery_date,
  status: deliveryOrders.status,
}

export function listOrders() {
  return db.select().from(deliveryOrders)
}

export function listOrdersPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & {
    sortBy?: string
    status?: string | string[]
    warehouseId?: string
  },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: deliveryOrders.status, value: opts.status })
  if (opts.warehouseId) extraFilters.push({ column: deliveryOrders.warehouse_id, value: opts.warehouseId })
  return listPaged(deliveryOrders, {
    ...opts,
    searchColumns: [deliveryOrders.no_do],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || deliveryOrders.delivery_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    dateColumn: deliveryOrders.delivery_date,
  })
}

export function findOrder(id: string) {
  return db.query.deliveryOrders.findFirst({ where: eq(deliveryOrders.id, id) })
}

// Row-locks the DO for the duration of the caller's transaction — used to
// serialize concurrent sale returns against the same DO (see
// sale-return.service.ts) so their "how much has already been returned"
// check can't race.
export async function getOrderForUpdate(tx: Tx, id: string) {
  const rows = await tx.select().from(deliveryOrders).where(eq(deliveryOrders.id, id)).for('update')
  return rows[0] ?? null
}

export function createOrder(values: {
  no_do: string
  so_id: string
  warehouse_id: string
  delivery_date: string
  status?: string
}) {
  return db.insert(deliveryOrders).values(values).returning()
}

export function updateOrderTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(deliveryOrders)
    .set({ ...values, updated_at: new Date() })
    .where(eq(deliveryOrders.id, id))
    .returning()
}

export function listItems(doId: string) {
  return db.select().from(deliveryOrderItems).where(eq(deliveryOrderItems.do_id, doId))
}

export function createItem(values: {
  do_id: string
  so_item_id: string
  product_id: string
  qty_delivered: string
}) {
  return db.insert(deliveryOrderItems).values(values).returning()
}

export function setItemCogsTx(tx: Tx, id: string, cogsPerUnit: string) {
  return tx
    .update(deliveryOrderItems)
    .set({ cogs_per_unit: cogsPerUnit, updated_at: new Date() })
    .where(eq(deliveryOrderItems.id, id))
    .returning()
}
