import { listOrders } from '../../../repositories/delivery-order.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listOrders()
  return success(rows)
})
