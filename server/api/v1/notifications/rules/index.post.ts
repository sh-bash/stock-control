import { z } from 'zod'
import { createRule } from '../../../../repositories/notification.repository'
import { success } from '../../../../utils/response'

const schema = z.object({
  type: z.string().min(1).max(30),
  scope_type: z.enum(['global', 'product', 'category', 'warehouse', 'product_warehouse']),
  scope_id: z.string().uuid().nullable().optional(),
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
  const rows = await createRule(parsed.data)
  return success(rows[0])
})
