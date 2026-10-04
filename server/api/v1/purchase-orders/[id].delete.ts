import { deletePurchaseOrder } from '../../../services/purchase-order.service'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  return success(await deletePurchaseOrder(getRouterParam(event, 'id')!))
})
