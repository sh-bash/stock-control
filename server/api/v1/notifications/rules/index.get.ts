import { db } from '../../../../db/client'
import { notificationRuleTargets } from '../../../../db/schema'
import { listRulesFiltered } from '../../../../repositories/notification.repository'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const type = typeof q.type === 'string' ? q.type : undefined
  const scopeType = typeof q.scope_type === 'string' ? q.scope_type : undefined

  const rules = await listRulesFiltered({ type, scopeType })
  const allTargets = await db.select().from(notificationRuleTargets)
  const withTargets = rules.map((rule) => ({
    ...rule,
    targets: allTargets.filter((t) => t.rule_id === rule.id),
  }))
  return success(withTargets)
})
