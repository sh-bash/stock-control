import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { stockTransfers, stockTransferItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_transfer: stockTransfers.no_transfer,
  transfer_date: stockTransfers.transfer_date,
  status: stockTransfers.status,
}

export function listTransfers() {
  return db.select().from(stockTransfers)
}

export function listTransfersPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & {
    sortBy?: string
    status?: string | string[]
    fromWarehouseId?: string
    toWarehouseId?: string
  },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: stockTransfers.status, value: opts.status })
  if (opts.fromWarehouseId) extraFilters.push({ column: stockTransfers.from_warehouse_id, value: opts.fromWarehouseId })
  if (opts.toWarehouseId) extraFilters.push({ column: stockTransfers.to_warehouse_id, value: opts.toWarehouseId })
  return listPaged(stockTransfers, {
    ...opts,
    searchColumns: [stockTransfers.no_transfer],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || stockTransfers.transfer_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    dateColumn: stockTransfers.transfer_date,
  })
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
