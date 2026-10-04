import { getComparisonDetail } from '../../../services/product-comparison.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const cmp = await getComparisonDetail(getRouterParam(event, 'id')!)
  if (!cmp) return failure('Comparison tidak ditemukan', 'NOT_FOUND', 404)
  return success(cmp)
})
