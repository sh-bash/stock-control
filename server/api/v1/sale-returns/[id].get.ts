import { getSaleReturnWithItems } from '../../../services/sale-return.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const ret = await getSaleReturnWithItems(id)
  if (!ret) return failure('Sale return tidak ditemukan', 'NOT_FOUND', 404)
  return success(ret)
})
