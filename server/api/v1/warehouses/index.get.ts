import { list, listPage } from '../../../repositories/warehouse.repository'
import { success } from '../../../utils/response'
import { parsePagingQuery } from '../../../utils/crud'

// Opt-in pagination: no `page` query param -> full array (used by every
// dropdown-options fetch elsewhere in the app). `page` present -> paginated
// { rows, totalRows } for the Master Data table UI.
export default defineEventHandler(async (event) => {
  const paging = parsePagingQuery(event)
  if (!paging) return success(await list())

  const { rows, totalRows } = await listPage(paging)
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
