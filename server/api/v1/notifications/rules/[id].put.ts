import { z } from 'zod'
import { updateRule } from '../../../../repositories/notification.repository'
import { success, failure } from '../../../../utils/response'

const schema = z.object({
  type: z.string().min(1).max(30).optional(),
  scope_type: z.enum(['global', 'product', 'category', 'warehouse', 'product_warehouse']).optional(),
  scope_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const rows = await updateRule(id, parsed.data)
  if (!rows[0]) return failure('Rule tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0])
})
