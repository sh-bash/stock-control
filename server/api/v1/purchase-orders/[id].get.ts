import { getPurchaseOrderWithItems } from '../../../services/purchase-order.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const po = await getPurchaseOrderWithItems(id)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)
  return success(po)
})
