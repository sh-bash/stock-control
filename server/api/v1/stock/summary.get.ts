import { listStockSummary } from '../../../repositories/stock.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listStockSummary()
  return success(rows)
})
