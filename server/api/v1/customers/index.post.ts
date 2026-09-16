import { z } from 'zod'
import { create } from '../../../repositories/customer.repository'
import { success } from '../../../utils/response'

const schema = z.object({
  name: z.string().min(1).max(150),
  contact: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  payment_term_days: z.number().int().optional(),
  price_level_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const rows = await create(parsed.data)
  return success(rows[0])
})
