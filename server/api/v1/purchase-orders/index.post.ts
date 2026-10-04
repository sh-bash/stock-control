import { createPurchaseOrder } from '../../../services/purchase-order.service'
import { success } from '../../../utils/response'
import { authUserId, readValidated } from '../../../utils/validate'
import { poSchema } from '../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, poSchema)
  return success(await createPurchaseOrder({ ...body, created_by: authUserId(event) }))
})
