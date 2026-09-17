import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { stockAdjustments, stockAdjustmentItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_adjustment: stockAdjustments.no_adjustment,
  adjustment_date: stockAdjustments.adjustment_date,
  status: stockAdjustments.status,
}

export function listAdjustments() {
  return db.select().from(stockAdjustments)
}

export function listAdjustmentsPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string; status?: string; warehouseId?: string },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: stockAdjustments.status, value: opts.status })
  if (opts.warehouseId) extraFilters.push({ column: stockAdjustments.warehouse_id, value: opts.warehouseId })
  return listPaged(stockAdjustments, {
    ...opts,
    searchColumns: [stockAdjustments.no_adjustment],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || stockAdjustments.adjustment_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
  })
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
