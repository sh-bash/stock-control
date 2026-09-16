import { confirmSaleOrder } from '../../../../services/sale-order.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const so = await confirmSaleOrder(id)
  return success(so)
})
