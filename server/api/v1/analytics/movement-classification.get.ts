import { listMovementClassificationsFiltered } from '../../../repositories/movement-analytics.repository'
import { success } from '../../../utils/response'
import { parseCsvQueryParam } from '../../../utils/crud'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const classification = parseCsvQueryParam(event, 'classification')

  const rows = await listMovementClassificationsFiltered({ warehouseId, classification })
  return success(rows)
})
