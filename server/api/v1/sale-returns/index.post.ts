import { z } from 'zod'
import { createAndProcessSaleReturn } from '../../../services/sale-return.service'
import { success } from '../../../utils/response'

const schema = z.object({
  source_type: z.enum(['so', 'do']),
  source_id: z.string().uuid(),
  return_date: z.string().min(1),
  condition: z.enum(['good', 'damaged']),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty_return: z.number().positive(),
      }),
    )
    .min(1),
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
  const ret = await createAndProcessSaleReturn(parsed.data)
  return success(ret)
})
