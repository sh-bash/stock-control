import { z } from 'zod'
import { listAttachments } from '../../../services/attachment.service'
import { success } from '../../../utils/response'
import { validateOrThrow } from '../../../utils/validate'

export default defineEventHandler(async (event) => {
  const q = validateOrThrow(z.object({ owner_type: z.string().min(1), owner_id: z.string().uuid() }), getQuery(event))
  return success(await listAttachments(q.owner_type, q.owner_id))
})
