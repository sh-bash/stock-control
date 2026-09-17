import { listTransfers, listTransfersPaged } from '../../../repositories/stock-transfer.repository'
import { success } from '../../../utils/response'
import { parseBasicPagingQuery } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await listTransfers())

  const q = getQuery(event)
  const status = typeof q.status === 'string' ? q.status : undefined

  const { rows, totalRows } = await listTransfersPaged({ ...paging, status })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
