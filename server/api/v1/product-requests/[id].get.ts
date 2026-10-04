import { getRequestWithItems } from '../../../services/product-request.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const req = await getRequestWithItems(getRouterParam(event, 'id')!)
  if (!req) return failure('Request tidak ditemukan', 'NOT_FOUND', 404)
  return success(req)
})
