import { updateProductRequest } from '../../../services/product-request.service'
import { success } from '../../../utils/response'
import { readValidated } from '../../../utils/validate'
import { requestSchema } from '../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, requestSchema)
  return success(await updateProductRequest(getRouterParam(event, 'id')!, body))
})
