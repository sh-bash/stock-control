import { deleteProductRequest } from '../../../services/product-request.service'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  return success(await deleteProductRequest(getRouterParam(event, 'id')!))
})
