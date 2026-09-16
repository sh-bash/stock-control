import { z } from 'zod'
import { createAdjustmentWithItems } from '../../../services/stock-adjustment.service'
import { success } from '../../../utils/response'

const schema = z.object({
  warehouse_id: z.string().uuid(),
  adjustment_date: z.string().min(1),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty_diff: z.number().refine((v) => v !== 0, 'qty_diff tidak boleh 0'),
        hpp: z.number().positive().optional(),
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
  const adjustment = await createAdjustmentWithItems(parsed.data)
  return success(adjustment)
})
