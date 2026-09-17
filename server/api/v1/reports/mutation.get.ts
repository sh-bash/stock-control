import { getStockCard, findLedgerEntryBefore } from '../../../repositories/report.repository'
import { failure, success } from '../../../utils/response'

// GET /api/v1/reports/mutation?product_id=...&warehouse_id=&date_from=&date_to=
// Kartu stok — a stock card is inherently per-product, so product_id is
// required. Filters straight onto the Fase 3 composite index on
// stock_ledger (product_id, warehouse_id, transaction_date) in that same
// left-to-right order, so Postgres can use it instead of a seq scan.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const productId = typeof q.product_id === 'string' ? q.product_id : undefined
  if (!productId) {
    return failure('product_id wajib diisi untuk kartu stok', 'PRODUCT_ID_REQUIRED', 400)
  }
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const dateFrom = typeof q.date_from === 'string' ? q.date_from : undefined
  const dateTo = typeof q.date_to === 'string' ? q.date_to : undefined

  const [rows, priorEntry] = await Promise.all([
    getStockCard({ productId, warehouseId, dateFrom, dateTo }),
    // Opening balance = balance carried in from before date_from. With no
    // date_from the query already spans all history, so there's nothing
    // "before" it — opening is 0.
    dateFrom ? findLedgerEntryBefore({ productId, warehouseId, beforeDate: dateFrom }) : null,
  ])

  // With date_from: opening = the last entry before it (or '0' if this is
  // the very first movement ever). Without date_from: the query already
  // covers all history from the start, so opening is always '0' — using
  // the first row's post-transaction balance here would double-count that
  // row's own movement into the "opening" figure.
  const openingQty = priorEntry ? priorEntry.running_balance_qty : '0'
  const openingValue = priorEntry ? priorEntry.running_balance_value : '0'

  return success({
    filters: { product_id: productId, warehouse_id: warehouseId, date_from: dateFrom, date_to: dateTo },
    opening_balance_qty: openingQty,
    opening_balance_value: openingValue,
    entries: rows,
    closing_balance_qty: rows[rows.length - 1]?.running_balance_qty ?? openingQty,
    closing_balance_value: rows[rows.length - 1]?.running_balance_value ?? openingValue,
  })
})
