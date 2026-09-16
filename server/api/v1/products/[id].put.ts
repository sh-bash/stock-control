import { z } from 'zod'
import { update } from '../../../repositories/product.repository'
import { success, failure } from '../../../utils/response'

const schema = z.object({
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(150).optional(),
  category_id: z.string().uuid().nullable().optional(),
  base_unit_id: z.string().uuid().nullable().optional(),
  costing_method: z.string().max(10).optional(),
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
  const rows = await update(id, parsed.data)
  if (!rows[0]) return failure('Product tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0])
})
