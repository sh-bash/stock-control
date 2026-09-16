import { db } from '../../../../db/client'
import { notificationRuleTargets } from '../../../../db/schema'
import { listRules } from '../../../../repositories/notification.repository'
import { success } from '../../../../utils/response'

export default defineEventHandler(async () => {
  const rules = await listRules()
  const allTargets = await db.select().from(notificationRuleTargets)
  const withTargets = rules.map((rule) => ({
    ...rule,
    targets: allTargets.filter((t) => t.rule_id === rule.id),
  }))
  return success(withTargets)
})
