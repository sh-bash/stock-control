import { list } from '../../../repositories/product.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await list()
  return success(rows)
})
