import { z } from 'zod'
import { updateSetting } from '../../../repositories/product-stock-settings.repository'
import { success, failure } from '../../../utils/response'

const schema = z.object({
  min_stock: z.number().nonnegative().nullable().optional(),
  reorder_point: z.number().nonnegative().nullable().optional(),
  reorder_qty: z.number().nonnegative().nullable().optional(),
  fast_moving_min_daily_out: z.number().nonnegative().nullable().optional(),
  slow_moving_max_daily_out: z.number().nonnegative().nullable().optional(),
  aging_warning_days: z.number().int().nonnegative().nullable().optional(),
  aging_danger_days: z.number().int().nonnegative().nullable().optional(),
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
  const d = parsed.data
  const values: Record<string, unknown> = {}
  if ('min_stock' in d) values.min_stock = d.min_stock != null ? d.min_stock.toString() : null
  if ('reorder_point' in d) values.reorder_point = d.reorder_point != null ? d.reorder_point.toString() : null
  if ('reorder_qty' in d) values.reorder_qty = d.reorder_qty != null ? d.reorder_qty.toString() : null
  if ('fast_moving_min_daily_out' in d)
    values.fast_moving_min_daily_out = d.fast_moving_min_daily_out != null ? d.fast_moving_min_daily_out.toString() : null
  if ('slow_moving_max_daily_out' in d)
    values.slow_moving_max_daily_out = d.slow_moving_max_daily_out != null ? d.slow_moving_max_daily_out.toString() : null
  if ('aging_warning_days' in d) values.aging_warning_days = d.aging_warning_days ?? null
  if ('aging_danger_days' in d) values.aging_danger_days = d.aging_danger_days ?? null
  if ('is_active' in d) values.is_active = d.is_active

  try {
    const rows = await updateSetting(id, values)
    if (!rows[0]) return failure('Setting tidak ditemukan', 'NOT_FOUND', 404)
    return success(rows[0])
  } catch (err: any) {
    // Re-activating a row (is_active: true) can collide with the partial
    // unique indexes on product_stock_settings the same way create can.
    if (err?.code === '23505') {
      throw createError({
        statusCode: 409,
        data: {
          success: false,
          data: null,
          message: 'Sudah ada override aktif lain untuk product/warehouse ini. Nonaktifkan yang lain terlebih dahulu.',
          meta: { code: 'DUPLICATE_SETTING' },
        },
      })
    }
    throw err
  }
})
