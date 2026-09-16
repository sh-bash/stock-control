import { listOrders } from '../../../repositories/sale-order.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listOrders()
  return success(rows)
})
