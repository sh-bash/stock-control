import { listOrders, listOrdersPaged } from '../../../repositories/sale-order.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listOrders())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const customerId = typeof q.customer_id === 'string' ? q.customer_id : undefined
  const useDo = typeof q.use_do === 'string' ? q.use_do : undefined

  const { rows, totalRows } = await listOrdersPaged({ ...paging, status, warehouseId, customerId, useDo })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
