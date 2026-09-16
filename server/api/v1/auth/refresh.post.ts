import { z } from 'zod'
import { refresh } from '../../../services/auth.service'
import { success } from '../../../utils/response'

const schema = z.object({
  refreshToken: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR' } },
    })
  }

  const result = await refresh(parsed.data.refreshToken)
  return success(result)
})
