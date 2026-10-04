import { z } from 'zod'
import { COMMENT_REF_TYPES, addComment } from '../../../services/comment.service'
import { success } from '../../../utils/response'
import { authUserId, readValidated } from '../../../utils/validate'

export default defineEventHandler(async (event) => {
  const body = await readValidated(
    event,
    z.object({
      ref_type: z.enum(COMMENT_REF_TYPES),
      ref_id: z.string().uuid(),
      message: z.string().trim().min(1).max(2000),
      is_issue: z.boolean().default(false),
    }),
  )
  return success(await addComment({ ...body, user_id: authUserId(event) }))
})
