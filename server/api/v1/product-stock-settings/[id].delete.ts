import { deleteSetting } from '../../../repositories/product-stock-settings.repository'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const rows = await deleteSetting(id)
  if (!rows[0]) return failure('Setting tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0], 'Setting dihapus')
})
