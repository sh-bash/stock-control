import { listStockLedger, listStockLedgerPaged } from '../../../repositories/stock.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

// stock_ledger is append-only for the lifetime of the business — this is
// the one list in the app where the UI (pages/stock/overview.vue) always
// sends `page`, so pagination is effectively mandatory here in practice,
// even though the endpoint keeps the same opt-in contract as every other
// list for consistency (and to not break any future non-paginated caller).
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const productId = typeof query.product_id === 'string' ? query.product_id : undefined
  const warehouseId = typeof query.warehouse_id === 'string' ? query.warehouse_id : undefined
  const transactionType = parseCsvQueryParam(event, 'transaction_type')

  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listStockLedger(productId, warehouseId))

  const { rows, totalRows } = await listStockLedgerPaged({ ...paging, productId, warehouseId, transactionType })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
