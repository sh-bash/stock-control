import { db } from '../db/client'
import { products } from '../db/schema'
import { eq } from 'drizzle-orm'
import {
  createNotification as createNotificationRow,
  createRecipients,
  findMatchingRules,
  getNotificationSetting,
  getTargetsForRules,
  resolveUsersFromTargets,
} from '../repositories/notification.repository'
import { sendToUser } from '../utils/sse'

export interface CreateNotificationInput {
  type: string
  severity: 'info' | 'warning' | 'danger'
  title: string
  message: string
  reference_type?: string | null
  reference_id?: string | null
  product_id?: string | null
  warehouse_id?: string | null
}

export async function createNotification(input: CreateNotificationInput) {
  let categoryId: string | null = null
  if (input.product_id) {
    const product = await db.query.products.findFirst({ where: eq(products.id, input.product_id) })
    categoryId = product?.category_id ?? null
  }

  const matchedRules = await findMatchingRules({
    type: input.type,
    productId: input.product_id ?? null,
    warehouseId: input.warehouse_id ?? null,
    categoryId,
  })

  if (matchedRules.length === 0) {
    return null
  }

  const targets = await getTargetsForRules(matchedRules.map((r) => r.id))
  const resolvedUserIds = await resolveUsersFromTargets(targets)

  const [notification] = await createNotificationRow({
    type: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    product_id: input.product_id ?? null,
    warehouse_id: input.warehouse_id ?? null,
  })

  const enabledUserIds: string[] = []
  for (const userId of resolvedUserIds) {
    const setting = await getNotificationSetting(userId, input.type)
    if (!setting || setting.is_enabled) {
      enabledUserIds.push(userId)
    }
  }

  const recipients = await createRecipients(notification.id, enabledUserIds)

  for (const recipient of recipients as any[]) {
    sendToUser(recipient.user_id, 'notification', {
      recipient_id: recipient.id,
      notification,
    })
  }

  return notification
}
