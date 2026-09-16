import { z } from 'zod'
import { update } from '../../../repositories/warehouse.repository'
import { success, failure } from '../../../utils/response'

const schema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  address: z.string().optional(),
  type: z.string().max(30).optional(),
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
  if (!rows[0]) return failure('Warehouse tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0])
})
