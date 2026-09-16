import { z } from 'zod'
import { createAndExecuteTransfer } from '../../../services/stock-transfer.service'
import { success } from '../../../utils/response'

const schema = z.object({
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  transfer_date: z.string().min(1),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        stock_layer_id: z.string().uuid(),
        qty: z.number().positive(),
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
  const transfer = await createAndExecuteTransfer(parsed.data)
  return success(transfer)
})
