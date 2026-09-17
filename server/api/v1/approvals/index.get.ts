import { db } from '../../../db/client'
import { approvalInstances } from '../../../db/schema'
import { success } from '../../../utils/response'
import { listPaged, parseBasicPagingQuery } from '../../../utils/crud'

const SORT_COLUMNS: Record<string, any> = {
  document_type: approvalInstances.document_type,
  status: approvalInstances.status,
  created_at: approvalInstances.created_at,
}

export default defineEventHandler(async (event) => {
  const paging = parseBasicPagingQuery(event)
  if (!paging) return success(await db.select().from(approvalInstances))

  const q = getQuery(event)
  const status = typeof q.status === 'string' ? q.status : undefined
  const documentType = typeof q.document_type === 'string' ? q.document_type : undefined

  const extraFilters = []
  if (status) extraFilters.push({ column: approvalInstances.status, value: status })
  if (documentType) extraFilters.push({ column: approvalInstances.document_type, value: documentType })

  const { rows, totalRows } = await listPaged(approvalInstances, {
    ...paging,
    sortColumn: (paging.sortBy && SORT_COLUMNS[paging.sortBy]) || approvalInstances.created_at,
    sortDir: paging.sortDir ?? 'desc',
    extraFilters,
  })
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
