import { runStockReconciliationJob } from '../../../../jobs/stock-reconciliation.job'
import { success } from '../../../../utils/response'

export default defineEventHandler(async () => {
  const result = await runStockReconciliationJob()
  return success(result, 'stock-reconciliation job executed')
})
