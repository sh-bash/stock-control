import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { receivings, receivingItems } from '../db/schema'

type Tx = PgTransaction<any, any, any>

export function listReceivings() {
  return db.select().from(receivings)
}

export function findReceiving(id: string) {
  return db.query.receivings.findFirst({ where: eq(receivings.id, id) })
}

export function createReceiving(values: {
  no_receiving: string
  shipment_id: string
  warehouse_id: string
  receive_date: string
  created_by: string
  status?: string
}) {
  return db.insert(receivings).values(values).returning()
}

export function updateReceiving(id: string, values: Record<string, unknown>) {
  return db
    .update(receivings)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(receivings.id, id))
    .returning()
}

export function updateReceivingTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(receivings)
    .set({ ...values, updated_at: new Date() })
    .where(eq(receivings.id, id))
    .returning()
}

export function deleteReceiving(id: string) {
  return db.delete(receivings).where(eq(receivings.id, id)).returning()
}

export function listReceivingItems(receivingId: string) {
  return db.select().from(receivingItems).where(eq(receivingItems.receiving_id, receivingId))
}

export function createReceivingItem(values: {
  receiving_id: string
  shipment_item_id: string
  po_item_id: string
  product_id: string
  qty_received: string
  unit_price: string
  shipping_cost_per_unit: string
  hpp: string
}) {
  return db.insert(receivingItems).values(values).returning()
}

export function setReceivingItemLayer(tx: Tx, itemId: string, stockLayerId: string) {
  return tx
    .update(receivingItems)
    .set({ stock_layer_id: stockLayerId, updated_at: new Date() })
    .where(eq(receivingItems.id, itemId))
    .returning()
}

export function deleteReceivingItem(id: string) {
  return db.delete(receivingItems).where(eq(receivingItems.id, id)).returning()
}
