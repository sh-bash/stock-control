import { getDeliveryOrderWithItems } from '../../../services/delivery-order.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const deliveryOrder = await getDeliveryOrderWithItems(id)
  if (!deliveryOrder) return failure('DO tidak ditemukan', 'NOT_FOUND', 404)
  return success(deliveryOrder)
})
