import { db } from '../../../db/client'
import { users } from '../../../db/schema'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role_id: users.role_id })
    .from(users)
  return success(rows)
})
