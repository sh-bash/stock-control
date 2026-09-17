import { runStockValuationSnapshotJob } from '../../../../jobs/stock-valuation-snapshot.job'
import { success } from '../../../../utils/response'

export default defineEventHandler(async () => {
  const result = await runStockValuationSnapshotJob()
  return success(result, 'stock-valuation-snapshot job executed')
})
