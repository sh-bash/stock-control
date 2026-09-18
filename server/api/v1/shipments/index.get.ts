import { listShipments, listShipmentsPaged } from '../../../repositories/shipment.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listShipments())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const expeditionId = typeof q.expedition_id === 'string' ? q.expedition_id : undefined

  const { rows, totalRows } = await listShipmentsPaged({ ...paging, status, expeditionId })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
