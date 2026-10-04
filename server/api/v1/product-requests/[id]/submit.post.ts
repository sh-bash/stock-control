import { submitProductRequest } from '../../../../services/product-request.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  return success(await submitProductRequest(getRouterParam(event, 'id')!), 'Request submitted')
})
