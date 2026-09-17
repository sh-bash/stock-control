import { list, listPage } from '../../../repositories/product-category.repository'
import { success } from '../../../utils/response'
import { parsePagingQuery } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const paging = parsePagingQuery(event)
  if (!paging) return success(await list())

  const { rows, totalRows } = await listPage(paging)
  return success(rows, null, { page: paging.page, pageSize: paging.pageSize, totalRows })
})
