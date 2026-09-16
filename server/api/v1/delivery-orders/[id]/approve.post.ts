import { approveDeliveryOrder } from '../../../../services/delivery-order.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const deliveryOrder = await approveDeliveryOrder(id)
  return success(deliveryOrder)
})
