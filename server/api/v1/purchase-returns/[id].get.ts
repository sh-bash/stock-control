import { getPurchaseReturnWithItems } from '../../../services/purchase-return.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const ret = await getPurchaseReturnWithItems(id)
  if (!ret) return failure('Purchase return tidak ditemukan', 'NOT_FOUND', 404)
  return success(ret)
})
