import { z } from 'zod'
import { setCommentIssue } from '../../../services/comment.service'
import { success } from '../../../utils/response'
import { authUserId, readValidated } from '../../../utils/validate'

export default defineEventHandler(async (event) => {
  const { is_issue } = await readValidated(event, z.object({ is_issue: z.boolean() }))
  return success(await setCommentIssue(getRouterParam(event, 'id')!, authUserId(event), is_issue))
})
