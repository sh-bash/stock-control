import { allocateShippingCost } from '../../../../services/shipment.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const items = await allocateShippingCost(id)
  return success(items, 'Shipping cost re-allocated')
})
