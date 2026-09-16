import { rebuildStockSummary } from '../../../services/stock.service'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const results = await rebuildStockSummary()
  return success(results, `Rebuilt stock_summary for ${results.length} product/warehouse combination(s)`)
})
