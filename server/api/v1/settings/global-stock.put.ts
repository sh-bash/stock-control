import { z } from 'zod'
import { upsertSettings } from '../../../repositories/global-stock-settings.repository'
import { success } from '../../../utils/response'

const schema = z.object({
  fast_moving_min_daily_out: z.number(),
  slow_moving_max_daily_out: z.number(),
  aging_warning_days: z.number().int(),
  aging_danger_days: z.number().int(),
  dead_stock_no_movement_days: z.number().int(),
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
  const row = await upsertSettings({
    fast_moving_min_daily_out: parsed.data.fast_moving_min_daily_out.toString(),
    slow_moving_max_daily_out: parsed.data.slow_moving_max_daily_out.toString(),
    aging_warning_days: parsed.data.aging_warning_days,
    aging_danger_days: parsed.data.aging_danger_days,
    dead_stock_no_movement_days: parsed.data.dead_stock_no_movement_days,
  })
  return success(row)
})
