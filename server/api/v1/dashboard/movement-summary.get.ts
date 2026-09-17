import { getMovementClassificationCounts } from '../../../repositories/dashboard.repository'
import { success } from '../../../utils/response'

const CLASSES = ['fast', 'normal', 'slow', 'dead'] as const

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined

  const rows = await getMovementClassificationCounts(warehouseId)
  const counts = Object.fromEntries(CLASSES.map((c) => [c, 0])) as Record<(typeof CLASSES)[number], number>
  for (const row of rows) {
    if (row.classification in counts) counts[row.classification as (typeof CLASSES)[number]] = Number(row.count)
  }

  return success({
    classifications: CLASSES.map((label) => ({ label, count: counts[label] })),
  })
})
