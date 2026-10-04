import { updatePurchaseOrder } from '../../../services/purchase-order.service'
import { success } from '../../../utils/response'
import { readValidated } from '../../../utils/validate'
import { poSchema } from '../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, poSchema)
  return success(await updatePurchaseOrder(getRouterParam(event, 'id')!, body))
})
