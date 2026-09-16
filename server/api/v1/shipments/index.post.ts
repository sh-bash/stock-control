import { z } from 'zod'
import { createShipmentWithItems } from '../../../services/shipment.service'
import { success } from '../../../utils/response'

const schema = z.object({
  expedition_id: z.string().uuid(),
  ship_date: z.string().min(1),
  total_shipping_cost: z.number().nonnegative(),
  allocation_method: z.enum(['per_qty', 'per_value', 'per_weight']),
  po_ids: z.array(z.string().uuid()).min(1),
  items: z
    .array(
      z.object({
        po_item_id: z.string().uuid(),
        qty_shipped: z.number().positive(),
        weight: z.number().positive().optional(),
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
  const shipment = await createShipmentWithItems(parsed.data)
  return success(shipment)
})
