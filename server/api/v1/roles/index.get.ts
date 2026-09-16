import { db } from '../../../db/client'
import { roles } from '../../../db/schema'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await db.select().from(roles)
  return success(rows)
})
