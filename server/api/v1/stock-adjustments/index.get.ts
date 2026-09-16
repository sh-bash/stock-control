import { listAdjustments } from '../../../repositories/stock-adjustment.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listAdjustments()
  return success(rows)
})
