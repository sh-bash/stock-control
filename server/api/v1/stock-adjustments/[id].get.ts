import { getAdjustmentWithItems } from '../../../services/stock-adjustment.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const adjustment = await getAdjustmentWithItems(id)
  if (!adjustment) return failure('Adjustment tidak ditemukan', 'NOT_FOUND', 404)
  return success(adjustment)
})
