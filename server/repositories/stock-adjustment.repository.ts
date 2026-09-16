import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { stockAdjustments, stockAdjustmentItems } from '../db/schema'

type Tx = PgTransaction<any, any, any>

export function listAdjustments() {
  return db.select().from(stockAdjustments)
}

export function findAdjustment(id: string) {
  return db.query.stockAdjustments.findFirst({ where: eq(stockAdjustments.id, id) })
}

export function createAdjustment(values: {
  no_adjustment: string
  warehouse_id: string
  adjustment_date: string
  reason?: string | null
  status?: string
}) {
  return db.insert(stockAdjustments).values(values).returning()
}

export function updateAdjustment(id: string, values: Record<string, unknown>) {
  return db
    .update(stockAdjustments)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(stockAdjustments.id, id))
    .returning()
}

export function updateAdjustmentTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(stockAdjustments)
    .set({ ...values, updated_at: new Date() })
    .where(eq(stockAdjustments.id, id))
    .returning()
}

export function listAdjustmentItems(adjustmentId: string) {
  return db.select().from(stockAdjustmentItems).where(eq(stockAdjustmentItems.adjustment_id, adjustmentId))
}

export function createAdjustmentItem(values: {
  adjustment_id: string
  product_id: string
  qty_diff: string
  hpp?: string | null
}) {
  return db.insert(stockAdjustmentItems).values(values).returning()
}
