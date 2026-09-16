import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import {
  notifications,
  notificationRecipients,
  notificationRules,
  notificationRuleTargets,
  notificationSettings,
  users,
} from '../db/schema'

export function createNotification(values: {
  type: string
  severity: string
  title: string
  message: string
  reference_type?: string | null
  reference_id?: string | null
  product_id?: string | null
  warehouse_id?: string | null
}) {
  return db.insert(notifications).values(values).returning()
}

export function createRecipients(notificationId: string, userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve([])
  return db
    .insert(notificationRecipients)
    .values(userIds.map((user_id) => ({ notification_id: notificationId, user_id })))
    .returning()
}

export async function findMatchingRules(params: {
  type: string
  productId?: string | null
  warehouseId?: string | null
  categoryId?: string | null
}) {
  const rules = await db.query.notificationRules.findMany({
    where: and(eq(notificationRules.type, params.type), eq(notificationRules.is_active, true)),
  })

  return rules.filter((rule) => {
    if (rule.scope_type === 'global') return true
    if (rule.scope_type === 'product' && rule.scope_id === params.productId) return true
    if (rule.scope_type === 'warehouse' && rule.scope_id === params.warehouseId) return true
    if (rule.scope_type === 'category' && rule.scope_id === params.categoryId) return true
    if (rule.scope_type === 'product_warehouse') {
      return false
    }
    return false
  })
}

export async function getTargetsForRules(ruleIds: string[]) {
  if (ruleIds.length === 0) return []
  return db.query.notificationRuleTargets.findMany({
    where: inArray(notificationRuleTargets.rule_id, ruleIds),
  })
}

export async function resolveUsersFromTargets(targets: { target_type: string; target_id: string }[]) {
  const roleIds = targets.filter((t) => t.target_type === 'role').map((t) => t.target_id)
  const userIds = targets.filter((t) => t.target_type === 'user').map((t) => t.target_id)

  const resolved = new Set<string>(userIds)

  if (roleIds.length > 0) {
    const roleUsers = await db.query.users.findMany({
      where: and(inArray(users.role_id, roleIds), eq(users.is_active, true)),
    })
    for (const u of roleUsers) resolved.add(u.id)
  }

  return Array.from(resolved)
}

export function getNotificationSetting(userId: string, type: string) {
  return db.query.notificationSettings.findFirst({
    where: and(eq(notificationSettings.user_id, userId), eq(notificationSettings.type, type)),
  })
}

export function listNotificationsForUser(userId: string) {
  return db
    .select({
      recipient_id: notificationRecipients.id,
      is_read: notificationRecipients.is_read,
      read_at: notificationRecipients.read_at,
      notification: notifications,
    })
    .from(notificationRecipients)
    .innerJoin(notifications, eq(notificationRecipients.notification_id, notifications.id))
    .where(eq(notificationRecipients.user_id, userId))
    .orderBy(desc(notifications.created_at))
}

export function markRecipientRead(recipientId: string, userId: string) {
  return db
    .update(notificationRecipients)
    .set({ is_read: true, read_at: new Date() })
    .where(and(eq(notificationRecipients.id, recipientId), eq(notificationRecipients.user_id, userId)))
    .returning()
}

// notification_rules CRUD
export function listRules() {
  return db.select().from(notificationRules)
}

export function createRule(values: { type: string; scope_type: string; scope_id?: string | null; is_active?: boolean }) {
  return db.insert(notificationRules).values(values).returning()
}

export function updateRule(id: string, values: Record<string, unknown>) {
  return db
    .update(notificationRules)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(notificationRules.id, id))
    .returning()
}

export function deleteRule(id: string) {
  return db.delete(notificationRules).where(eq(notificationRules.id, id)).returning()
}

export function listTargetsByRule(ruleId: string) {
  return db.select().from(notificationRuleTargets).where(eq(notificationRuleTargets.rule_id, ruleId))
}

export function addTarget(ruleId: string, targetType: string, targetId: string) {
  return db
    .insert(notificationRuleTargets)
    .values({ rule_id: ruleId, target_type: targetType, target_id: targetId })
    .returning()
}

export function removeTarget(id: string) {
  return db.delete(notificationRuleTargets).where(eq(notificationRuleTargets.id, id)).returning()
}
