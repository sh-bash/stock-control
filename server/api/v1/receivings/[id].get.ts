import { getReceivingWithItems } from '../../../services/receiving.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const receiving = await getReceivingWithItems(id)
  if (!receiving) return failure('Receiving tidak ditemukan', 'NOT_FOUND', 404)
  return success(receiving)
})
