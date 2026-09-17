import { listStockLayers, listStockLayersPaged } from '../../../repositories/stock.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const productId = typeof query.product_id === 'string' ? query.product_id : undefined
  const warehouseId = typeof query.warehouse_id === 'string' ? query.warehouse_id : undefined

  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listStockLayers(productId, warehouseId))

  const status = typeof query.status === 'string' ? query.status : undefined
  const { rows, totalRows } = await listStockLayersPaged({ ...paging, productId, warehouseId, status })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
