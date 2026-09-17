import { runStockValuationSnapshotJob } from '../jobs/stock-valuation-snapshot.job'

export default defineTask({
  meta: {
    name: 'stock-valuation-snapshot',
    description: 'Daily: snapshot qty_on_hand/total_value per product+warehouse for inventory valuation reporting',
  },
  async run() {
    const result = await runStockValuationSnapshotJob()
    return { result }
  },
})
