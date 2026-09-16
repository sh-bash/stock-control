import { listNotificationsForUser } from '../../../repositories/notification.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as { sub: string }
  const rows = await listNotificationsForUser(auth.sub)
  return success(rows)
})
