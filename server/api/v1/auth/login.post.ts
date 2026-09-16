import { z } from 'zod'
import { login } from '../../../services/auth.service'
import { success } from '../../../utils/response'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

  const result = await login(parsed.data.email, parsed.data.password)
  return success(result)
})
