import { createProductRequest } from '../../../services/product-request.service'
import { success } from '../../../utils/response'
import { authUserId, readValidated } from '../../../utils/validate'
import { requestSchema } from '../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, requestSchema)
  const req = await createProductRequest({ ...body, requested_by: authUserId(event) })
  return success(req)
})
