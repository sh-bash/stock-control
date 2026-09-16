import { listMovementStats } from '../../../repositories/movement-analytics.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listMovementStats()
  return success(rows)
})
