import { listOrders, listOrdersPaged } from '../../../repositories/purchase-order.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listOrders())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const supplierId = typeof q.supplier_id === 'string' ? q.supplier_id : undefined

  const { rows, totalRows } = await listOrdersPaged({ ...paging, status, warehouseId, supplierId })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
