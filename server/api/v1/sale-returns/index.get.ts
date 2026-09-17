import { listReturns, listReturnsPaged } from '../../../repositories/sale-return.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listReturns())

  const q = getQuery(event)
  const status = typeof q.status === 'string' ? q.status : undefined
  const condition = typeof q.condition === 'string' ? q.condition : undefined

  const { rows, totalRows } = await listReturnsPaged({ ...paging, status, condition })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
