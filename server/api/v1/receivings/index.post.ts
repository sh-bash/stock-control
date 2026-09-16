import { z } from 'zod'
import { createReceivingWithItems } from '../../../services/receiving.service'
import { success } from '../../../utils/response'

const schema = z.object({
  shipment_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  receive_date: z.string().min(1),
  items: z
    .array(
      z.object({
        shipment_item_id: z.string().uuid(),
        po_item_id: z.string().uuid(),
        product_id: z.string().uuid(),
        qty_received: z.number().positive(),
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
  const receiving = await createReceivingWithItems({ ...parsed.data, created_by: auth.sub })
  return success(receiving)
})
