import { submitPurchaseReturn } from '../../../../services/purchase-return.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const result = await submitPurchaseReturn(id)
  return success(result, 'Purchase return submitted for approval')
})
