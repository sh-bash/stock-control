import { z } from 'zod'
import { createNotification } from '../../../services/notification.service'
import { success, failure } from '../../../utils/response'

const schema = z.object({
  type: z.string().min(1).max(30).default('min_stock'),
  severity: z.enum(['info', 'warning', 'danger']).default('danger'),
  title: z.string().min(1).max(200).default('Test Notification'),
  message: z.string().min(1).default('Ini adalah notifikasi test manual.'),
  product_id: z.string().uuid().nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }

  const notification = await createNotification(parsed.data)
  if (!notification) {
    return failure(
      'Tidak ada notification_rules aktif yang cocok untuk type ini, buat rule dulu di /api/v1/notifications/rules',
      'NO_MATCHING_RULE',
      404,
    )
  }
  return success(notification, 'Notification triggered')
})
