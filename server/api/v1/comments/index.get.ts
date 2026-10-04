import { z } from 'zod'
import { COMMENT_REF_TYPES, listComments } from '../../../services/comment.service'
import { success } from '../../../utils/response'
import { validateOrThrow } from '../../../utils/validate'

export default defineEventHandler(async (event) => {
  const q = validateOrThrow(z.object({ ref_type: z.enum(COMMENT_REF_TYPES), ref_id: z.string().uuid() }), getQuery(event))
  return success(await listComments(q.ref_type, q.ref_id))
})
