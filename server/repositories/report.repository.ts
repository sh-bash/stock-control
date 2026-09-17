import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../db/client'
import {
  purchaseOrders,
  purchaseOrderItems,
  saleOrders,
  saleOrderItems,
  deliveryOrders,
  deliveryOrderItems,
  stockLedger,
  products,
} from '../db/schema'

// Lets a report accept either a specific product_id or a category_id (PRD:
// "filter periode, warehouse, dan product/kategori") — the API layer
// resolves category_id to the product ids under it via this, then passes
// them down as an IN-filter.
export async function resolveProductIdsForCategory(categoryId: string) {
  const rows = await db.select({ id: products.id }).from(products).where(eq(products.category_id, categoryId))
  return rows.map((r) => r.id)
}

// ============================================================
// Purchase report
// ============================================================

export function listOutstandingPurchaseOrders(filters: {
  supplierId?: string
  warehouseId?: string
  dateFrom?: string
  dateTo?: string
  productIds?: string[]
}) {
  const conditions = [inArray(purchaseOrders.status, ['approved', 'partial_received'])]
  if (filters.supplierId) conditions.push(eq(purchaseOrders.supplier_id, filters.supplierId))
  if (filters.warehouseId) conditions.push(eq(purchaseOrders.warehouse_id, filters.warehouseId))
  if (filters.dateFrom) conditions.push(gte(purchaseOrders.order_date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(purchaseOrders.order_date, filters.dateTo))
  if (filters.productIds) conditions.push(inArray(purchaseOrderItems.product_id, filters.productIds))

  return db
    .select({
      po_id: purchaseOrders.id,
      no_po: purchaseOrders.no_po,
      supplier_id: purchaseOrders.supplier_id,
      warehouse_id: purchaseOrders.warehouse_id,
      order_date: purchaseOrders.order_date,
      status: purchaseOrders.status,
      item_id: purchaseOrderItems.id,
      product_id: purchaseOrderItems.product_id,
      qty_order: purchaseOrderItems.qty_order,
      qty_received: purchaseOrderItems.qty_received,
      unit_price: purchaseOrderItems.unit_price,
      remaining: sql<string>`${purchaseOrderItems.qty_order} - ${purchaseOrderItems.qty_received}`,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrderItems.po_id, purchaseOrders.id))
    .where(and(...conditions, sql`${purchaseOrderItems.qty_order} > ${purchaseOrderItems.qty_received}`))
    .orderBy(desc(purchaseOrders.order_date))
}

export function listPurchasePriceHistory(filters: {
  productId?: string
  supplierId?: string
  dateFrom?: string
  dateTo?: string
  productIds?: string[]
}) {
  const conditions = []
  if (filters.productId) conditions.push(eq(purchaseOrderItems.product_id, filters.productId))
  if (filters.productIds) conditions.push(inArray(purchaseOrderItems.product_id, filters.productIds))
  if (filters.supplierId) conditions.push(eq(purchaseOrders.supplier_id, filters.supplierId))
  if (filters.dateFrom) conditions.push(gte(purchaseOrders.order_date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(purchaseOrders.order_date, filters.dateTo))

  const query = db
    .select({
      product_id: purchaseOrderItems.product_id,
      po_id: purchaseOrders.id,
      no_po: purchaseOrders.no_po,
      supplier_id: purchaseOrders.supplier_id,
      order_date: purchaseOrders.order_date,
      unit_price: purchaseOrderItems.unit_price,
      qty_order: purchaseOrderItems.qty_order,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrderItems.po_id, purchaseOrders.id))
    .orderBy(asc(purchaseOrders.order_date))

  return conditions.length > 0 ? query.where(and(...conditions)) : query
}

// ============================================================
// Sale report — §6.4: use_do=false sells are recorded on the
// stock_ledger's 'delivery' entry (reference_type='so'); use_do=true sells
// are recorded per delivery_order_item once its DO is approved
// (cogs_per_unit already stored there). Both are read separately and
// merged by the service layer into one revenue/COGS/margin report.
// ============================================================

export function listDirectSaleLines(filters: {
  customerId?: string
  warehouseId?: string
  productId?: string
  dateFrom?: string
  dateTo?: string
  productIds?: string[]
}) {
  const conditions = [eq(saleOrders.use_do, false), eq(saleOrders.status, 'closed')]
  if (filters.customerId) conditions.push(eq(saleOrders.customer_id, filters.customerId))
  if (filters.warehouseId) conditions.push(eq(saleOrders.warehouse_id, filters.warehouseId))
  if (filters.productId) conditions.push(eq(saleOrderItems.product_id, filters.productId))
  if (filters.productIds) conditions.push(inArray(saleOrderItems.product_id, filters.productIds))
  if (filters.dateFrom) conditions.push(gte(saleOrders.order_date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(saleOrders.order_date, filters.dateTo))

  return db
    .select({
      so_id: saleOrders.id,
      no_so: saleOrders.no_so,
      customer_id: saleOrders.customer_id,
      warehouse_id: saleOrders.warehouse_id,
      order_date: saleOrders.order_date,
      product_id: saleOrderItems.product_id,
      qty: saleOrderItems.qty_delivered,
      sell_price: saleOrderItems.sell_price,
      cogs_per_unit: stockLedger.hpp_used,
    })
    .from(saleOrderItems)
    .innerJoin(saleOrders, eq(saleOrderItems.so_id, saleOrders.id))
    .leftJoin(
      stockLedger,
      and(
        eq(stockLedger.reference_type, 'so'),
        eq(stockLedger.reference_id, saleOrders.id),
        eq(stockLedger.product_id, saleOrderItems.product_id),
        eq(stockLedger.transaction_type, 'delivery'),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(saleOrders.order_date))
}

export function listDeliveryOrderSaleLines(filters: {
  customerId?: string
  warehouseId?: string
  productId?: string
  dateFrom?: string
  dateTo?: string
  productIds?: string[]
}) {
  const conditions = [eq(deliveryOrders.status, 'approved')]
  if (filters.customerId) conditions.push(eq(saleOrders.customer_id, filters.customerId))
  if (filters.warehouseId) conditions.push(eq(deliveryOrders.warehouse_id, filters.warehouseId))
  if (filters.productId) conditions.push(eq(deliveryOrderItems.product_id, filters.productId))
  if (filters.productIds) conditions.push(inArray(deliveryOrderItems.product_id, filters.productIds))
  if (filters.dateFrom) conditions.push(gte(deliveryOrders.delivery_date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(deliveryOrders.delivery_date, filters.dateTo))

  return db
    .select({
      so_id: saleOrders.id,
      no_so: saleOrders.no_so,
      do_id: deliveryOrders.id,
      no_do: deliveryOrders.no_do,
      customer_id: saleOrders.customer_id,
      warehouse_id: deliveryOrders.warehouse_id,
      order_date: deliveryOrders.delivery_date,
      product_id: deliveryOrderItems.product_id,
      qty: deliveryOrderItems.qty_delivered,
      sell_price: saleOrderItems.sell_price,
      cogs_per_unit: deliveryOrderItems.cogs_per_unit,
    })
    .from(deliveryOrderItems)
    .innerJoin(deliveryOrders, eq(deliveryOrderItems.do_id, deliveryOrders.id))
    .innerJoin(saleOrders, eq(deliveryOrders.so_id, saleOrders.id))
    .innerJoin(saleOrderItems, eq(deliveryOrderItems.so_item_id, saleOrderItems.id))
    .where(and(...conditions))
    .orderBy(desc(deliveryOrders.delivery_date))
}

// ============================================================
// Mutation report (kartu stok) — straight off stock_ledger, filtered on
// exactly the columns the Fase 3 composite index
// (product_id, warehouse_id, transaction_date) covers, left-to-right, so
// Postgres can use it instead of a sequential scan.
// ============================================================

export function getStockCard(filters: {
  productId: string
  warehouseId?: string
  dateFrom?: string
  dateTo?: string
}) {
  const conditions = [eq(stockLedger.product_id, filters.productId)]
  if (filters.warehouseId) conditions.push(eq(stockLedger.warehouse_id, filters.warehouseId))
  if (filters.dateFrom) conditions.push(gte(stockLedger.transaction_date, new Date(filters.dateFrom)))
  if (filters.dateTo) conditions.push(lte(stockLedger.transaction_date, new Date(filters.dateTo)))

  return db
    .select()
    .from(stockLedger)
    .where(and(...conditions))
    .orderBy(asc(stockLedger.transaction_date))
}

// The stock card's opening balance is the running balance carried in from
// BEFORE date_from — the last ledger entry strictly earlier than it — not
// the balance after the period's first entry. Without date_from there's no
// "before" (the query already covers all history), so the caller should
// treat that case as an opening balance of 0.
export async function findLedgerEntryBefore(filters: {
  productId: string
  warehouseId?: string
  beforeDate: string
}) {
  const conditions = [
    eq(stockLedger.product_id, filters.productId),
    sql`${stockLedger.transaction_date} < ${new Date(filters.beforeDate).toISOString()}`,
  ]
  if (filters.warehouseId) conditions.push(eq(stockLedger.warehouse_id, filters.warehouseId))

  const rows = await db
    .select()
    .from(stockLedger)
    .where(and(...conditions))
    .orderBy(desc(stockLedger.transaction_date))
    .limit(1)
  return rows[0] ?? null
}
