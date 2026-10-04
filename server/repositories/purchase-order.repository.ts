import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { products, purchaseOrders, purchaseOrderItems, suppliers } from '../db/schema'
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
    requestId?: string
    comparisonId?: string
  },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: purchaseOrders.status, value: opts.status })
  if (opts.warehouseId) extraFilters.push({ column: purchaseOrders.warehouse_id, value: opts.warehouseId })
  if (opts.supplierId) extraFilters.push({ column: purchaseOrders.supplier_id, value: opts.supplierId })
  if (opts.requestId) extraFilters.push({ column: purchaseOrders.request_id, value: opts.requestId })
  if (opts.comparisonId) extraFilters.push({ column: purchaseOrders.comparison_id, value: opts.comparisonId })
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

export function createOrder(values: typeof purchaseOrders.$inferInsert) {
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

export function createItem(values: typeof purchaseOrderItems.$inferInsert) {
  return db.insert(purchaseOrderItems).values(values).returning()
}

export function deleteItemsOfOrder(poId: string) {
  return db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.po_id, poId))
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

// Open PO lines that can still be put on a shipment (approved / partially
// received POs with qty left), joined with supplier and product so the
// Shipment picker can search by PO number, supplier or product.
export function listShippableItems(filters: { search?: string; supplierId?: string; productId?: string }) {
  const conditions = [
    inArray(purchaseOrders.status, ['approved', 'partial_received']),
    sql`${purchaseOrderItems.qty_order} > ${purchaseOrderItems.qty_received}`,
  ]
  if (filters.supplierId) conditions.push(eq(purchaseOrders.supplier_id, filters.supplierId))
  if (filters.productId) conditions.push(eq(purchaseOrderItems.product_id, filters.productId))
  if (filters.search) {
    const like = `%${filters.search}%`
    conditions.push(
      or(ilike(purchaseOrders.no_po, like), ilike(products.name, like), ilike(products.sku, like), ilike(suppliers.name, like))!,
    )
  }

  return db
    .select({
      po_id: purchaseOrders.id,
      no_po: purchaseOrders.no_po,
      order_date: purchaseOrders.order_date,
      currency: purchaseOrders.currency,
      status: purchaseOrders.status,
      supplier_id: suppliers.id,
      supplier_name: suppliers.name,
      item_id: purchaseOrderItems.id,
      product_id: products.id,
      sku: products.sku,
      product_name: products.name,
      qty_order: purchaseOrderItems.qty_order,
      qty_received: purchaseOrderItems.qty_received,
      unit_price: purchaseOrderItems.unit_price,
      weight_kg: products.weight_kg,
      length_cm: products.length_cm,
      width_cm: products.width_cm,
      height_cm: products.height_cm,
      pack_length_cm: products.pack_length_cm,
      pack_width_cm: products.pack_width_cm,
      pack_height_cm: products.pack_height_cm,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrderItems.po_id, purchaseOrders.id))
    .innerJoin(suppliers, eq(purchaseOrders.supplier_id, suppliers.id))
    .innerJoin(products, eq(purchaseOrderItems.product_id, products.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.order_date), purchaseOrders.no_po)
    .limit(800)
}
