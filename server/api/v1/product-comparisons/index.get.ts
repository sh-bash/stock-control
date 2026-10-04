import { listComparisons, listComparisonsPaged } from '../../../repositories/product-comparison.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listComparisons())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const requestId = typeof q.request_id === 'string' ? q.request_id : undefined

  const { rows, totalRows } = await listComparisonsPaged({ ...paging, status, requestId })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
