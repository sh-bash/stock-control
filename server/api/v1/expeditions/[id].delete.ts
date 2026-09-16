import { remove } from '../../../repositories/expedition.repository'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const rows = await remove(id)
  if (!rows[0]) return failure('Expedition tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0], 'Expedition dihapus')
})
