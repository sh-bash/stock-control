import { listReturns, listReturnsPaged } from '../../../repositories/sale-return.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery, parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listReturns())

  const q = getQuery(event)
  const status = parseCsvQueryParam(event, 'status')
  const condition = typeof q.condition === 'string' ? q.condition : undefined
  const sourceType = typeof q.source_type === 'string' ? q.source_type : undefined

  const { rows, totalRows } = await listReturnsPaged({ ...paging, status, condition, sourceType })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
