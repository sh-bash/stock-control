import { listStockSummary, listStockSummaryPaged } from '../../../repositories/stock.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listStockSummary())

  const q = getQuery(event)
  const productId = typeof q.product_id === 'string' ? q.product_id : undefined
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const categoryId = typeof q.category_id === 'string' ? q.category_id : undefined
  const condition = typeof q.condition === 'string' ? (q.condition as 'normal' | 'low' | 'out') : undefined

  const { rows, totalRows } = await listStockSummaryPaged({ ...paging, productId, warehouseId, categoryId, condition })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
