import { z } from 'zod'
import { addTarget } from '../../../../../../repositories/notification.repository'
import { success } from '../../../../../../utils/response'

const schema = z.object({
  target_type: z.enum(['role', 'user']),
  target_id: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const ruleId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const rows = await addTarget(ruleId, parsed.data.target_type, parsed.data.target_id)
  return success(rows[0])
})
