import { runStockReconciliationJob } from '../jobs/stock-reconciliation.job'

export default defineTask({
  meta: {
    name: 'stock-reconciliation',
    description: 'Weekly: compare stock_summary against SUM(stock_layers.qty_remaining) and log drift',
  },
  async run() {
    const result = await runStockReconciliationJob()
    return { result }
  },
})
