import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { stockTransfers, stockTransferItems } from '../db/schema'

type Tx = PgTransaction<any, any, any>

export function listTransfers() {
  return db.select().from(stockTransfers)
}

export function findTransfer(id: string) {
  return db.query.stockTransfers.findFirst({ where: eq(stockTransfers.id, id) })
}

export function createTransfer(values: {
  no_transfer: string
  from_warehouse_id: string
  to_warehouse_id: string
  transfer_date: string
  status?: string
}) {
  return db.insert(stockTransfers).values(values).returning()
}

export function updateTransferTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(stockTransfers)
    .set({ ...values, updated_at: new Date() })
    .where(eq(stockTransfers.id, id))
    .returning()
}

export function listTransferItems(transferId: string) {
  return db.select().from(stockTransferItems).where(eq(stockTransferItems.transfer_id, transferId))
}

export function createTransferItem(values: {
  transfer_id: string
  product_id: string
  stock_layer_id: string
  qty: string
}) {
  return db.insert(stockTransferItems).values(values).returning()
}
