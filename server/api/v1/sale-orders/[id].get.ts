import { getSaleOrderWithItems } from '../../../services/sale-order.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const so = await getSaleOrderWithItems(id)
  if (!so) return failure('SO tidak ditemukan', 'NOT_FOUND', 404)
  return success(so)
})
