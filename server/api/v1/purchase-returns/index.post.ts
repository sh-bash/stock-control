import { z } from 'zod'
import { createPurchaseReturnWithItems } from '../../../services/purchase-return.service'
import { success } from '../../../utils/response'

const schema = z.object({
  receiving_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  return_date: z.string().min(1),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        stock_layer_id: z.string().uuid(),
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
  const ret = await createPurchaseReturnWithItems(parsed.data)
  return success(ret)
})
