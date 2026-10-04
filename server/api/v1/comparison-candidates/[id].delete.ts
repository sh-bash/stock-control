import { removeCandidate } from '../../../services/product-comparison.service'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  return success(await removeCandidate(getRouterParam(event, 'id')!))
})
