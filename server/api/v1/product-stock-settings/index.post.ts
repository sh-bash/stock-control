import { z } from 'zod'
import { createSetting } from '../../../repositories/product-stock-settings.repository'
import { success } from '../../../utils/response'

const schema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid().nullable().optional(),
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
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const d = parsed.data
  try {
    const rows = await createSetting({
      product_id: d.product_id,
      warehouse_id: d.warehouse_id ?? null,
      min_stock: d.min_stock != null ? d.min_stock.toString() : null,
      reorder_point: d.reorder_point != null ? d.reorder_point.toString() : null,
      reorder_qty: d.reorder_qty != null ? d.reorder_qty.toString() : null,
      fast_moving_min_daily_out: d.fast_moving_min_daily_out != null ? d.fast_moving_min_daily_out.toString() : null,
      slow_moving_max_daily_out: d.slow_moving_max_daily_out != null ? d.slow_moving_max_daily_out.toString() : null,
      aging_warning_days: d.aging_warning_days ?? null,
      aging_danger_days: d.aging_danger_days ?? null,
      is_active: d.is_active,
    })
    return success(rows[0])
  } catch (err: any) {
    // Postgres unique_violation on the partial unique indexes guarding
    // "at most one active override per product+warehouse" (and per
    // product-level row) — see schema.ts on product_stock_settings.
    if (err?.code === '23505') {
      throw createError({
        statusCode: 409,
        data: {
          success: false,
          data: null,
          message: d.warehouse_id
            ? 'Sudah ada override aktif untuk product dan warehouse ini. Nonaktifkan atau edit yang lama terlebih dahulu.'
            : 'Sudah ada override aktif untuk semua warehouse pada product ini. Nonaktifkan atau edit yang lama terlebih dahulu.',
          meta: { code: 'DUPLICATE_SETTING' },
        },
      })
    }
    throw err
  }
})
