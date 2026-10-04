import { z } from 'zod'
import { getReturnWarnings } from '../../../services/comment.service'
import { success } from '../../../utils/response'
import { validateOrThrow } from '../../../utils/validate'

// GET /api/v1/purchase-returns/warnings?receiving_id=
// Issue-flagged comments from the receiving, its POs and their product requests.
export default defineEventHandler(async (event) => {
  const q = validateOrThrow(z.object({ receiving_id: z.string().uuid() }), getQuery(event))
  return success(await getReturnWarnings(q.receiving_id))
})
