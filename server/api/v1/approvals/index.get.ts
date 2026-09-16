import { db } from '../../../db/client'
import { approvalInstances } from '../../../db/schema'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await db.select().from(approvalInstances)
  return success(rows)
})
