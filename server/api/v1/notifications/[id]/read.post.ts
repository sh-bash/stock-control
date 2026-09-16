import { markRecipientRead } from '../../../../repositories/notification.repository'
import { success, failure } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as { sub: string }
  const id = getRouterParam(event, 'id')!
  const rows = await markRecipientRead(id, auth.sub)
  if (!rows[0]) return failure('Notifikasi tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0])
})
