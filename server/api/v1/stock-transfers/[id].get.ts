import { getTransferWithItems } from '../../../services/stock-transfer.service'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const transfer = await getTransferWithItems(id)
  if (!transfer) return failure('Transfer tidak ditemukan', 'NOT_FOUND', 404)
  return success(transfer)
})
