import { listAdjustments, listAdjustmentsPaged } from '../../../repositories/stock-adjustment.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listAdjustments())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined

  const { rows, totalRows } = await listAdjustmentsPaged({ ...paging, status, warehouseId })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
