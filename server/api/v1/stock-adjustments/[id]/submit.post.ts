import { submitAdjustment } from '../../../../services/stock-adjustment.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const result = await submitAdjustment(id)
  return success(result, 'Adjustment submitted for approval')
})
