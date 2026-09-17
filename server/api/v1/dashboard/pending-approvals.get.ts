import { listPendingApprovalsForUser } from '../../../repositories/dashboard.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as { sub: string }
  const rows = await listPendingApprovalsForUser(auth.sub)
  return success(rows)
})
