import { eq, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { purchaseOrders, purchaseOrderItems } from '../db/schema'

type Tx = PgTransaction<any, any, any>

export function listOrders() {
  return db.select().from(purchaseOrders)
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
