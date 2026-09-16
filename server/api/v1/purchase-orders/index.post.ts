import { z } from 'zod'
import { createPurchaseOrder } from '../../../services/purchase-order.service'
import { success } from '../../../utils/response'

const schema = z.object({
  supplier_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  order_date: z.string().min(1),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty_order: z.number().positive(),
        unit_price: z.number().nonnegative(),
      }),
    )
    .min(1),
})

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as { sub: string }
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const po = await createPurchaseOrder({ ...parsed.data, created_by: auth.sub })
  return success(po)
})
