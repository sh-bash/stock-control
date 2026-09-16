import { z } from 'zod'
import { create } from '../../../repositories/expedition.repository'
import { success } from '../../../utils/response'

const schema = z.object({
  name: z.string().min(1).max(150),
  contact: z.string().max(100).optional(),
  default_allocation_method: z.enum(['per_qty', 'per_value', 'per_weight']).optional(),
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
