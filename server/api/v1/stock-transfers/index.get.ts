import { listTransfers, listTransfersPaged } from '../../../repositories/stock-transfer.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listTransfers())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const fromWarehouseId = typeof q.from_warehouse_id === 'string' ? q.from_warehouse_id : undefined
  const toWarehouseId = typeof q.to_warehouse_id === 'string' ? q.to_warehouse_id : undefined

  const { rows, totalRows } = await listTransfersPaged({ ...paging, status, fromWarehouseId, toWarehouseId })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
