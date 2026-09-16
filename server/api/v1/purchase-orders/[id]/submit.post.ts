import { submitPurchaseOrder } from '../../../../services/purchase-order.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const result = await submitPurchaseOrder(id)
  return success(result, 'PO submitted for approval')
})
