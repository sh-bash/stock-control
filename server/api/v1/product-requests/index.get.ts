import { listRequests, listRequestsPaged } from '../../../repositories/product-request.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listRequests())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const requestedBy = typeof q.requested_by === 'string' ? q.requested_by : undefined

  const { rows, totalRows } = await listRequestsPaged({ ...paging, status, requestedBy })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
