import { z } from 'zod'
import { createDeliveryOrderWithItems } from '../../../services/delivery-order.service'
import { success } from '../../../utils/response'

const schema = z.object({
  so_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  delivery_date: z.string().min(1),
  items: z
    .array(
      z.object({
        so_item_id: z.string().uuid(),
        product_id: z.string().uuid(),
        qty_delivered: z.number().positive(),
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
  const deliveryOrder = await createDeliveryOrderWithItems(parsed.data)
  return success(deliveryOrder)
})
