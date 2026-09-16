import { z } from 'zod'
import { create } from '../../../repositories/warehouse.repository'
import { success } from '../../../utils/response'

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  address: z.string().optional(),
  type: z.string().max(30).optional(),
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
