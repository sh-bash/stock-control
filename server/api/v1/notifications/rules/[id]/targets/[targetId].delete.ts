import { removeTarget } from '../../../../../../repositories/notification.repository'
import { success, failure } from '../../../../../../utils/response'

export default defineEventHandler(async (event) => {
  const targetId = getRouterParam(event, 'targetId')!
  const rows = await removeTarget(targetId)
  if (!rows[0]) return failure('Target tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0], 'Target dihapus')
})
