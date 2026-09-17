import {
  aggregateCurrentStockByProductWarehouse,
  upsertSnapshot,
} from '../repositories/stock-valuation.repository'
import { runJobWithLogging } from './job-runner'

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

// Fase 8: /api/v1/reports/inventory-valuation reads from
// stock_valuation_snapshot, which only this job populates. Upserted on
// (snapshot_date, product_id, warehouse_id), so running it more than once
// on the same day recomputes and overwrites the same row rather than
// accumulating duplicates — idempotent by construction, same as the other
// Fase 7 jobs.
export async function runStockValuationSnapshotJob() {
  return runJobWithLogging('stock-valuation-snapshot', async () => {
    const aggregates = await aggregateCurrentStockByProductWarehouse()
    const snapshotDate = todayDateOnly()

    for (const agg of aggregates) {
      await upsertSnapshot({
        snapshot_date: snapshotDate,
        product_id: agg.product_id,
        warehouse_id: agg.warehouse_id,
        qty_on_hand: agg.qty_on_hand,
        total_value: agg.total_value,
      })
    }

    return { rowsProcessed: aggregates.length, result: { snapshotDate, combinations: aggregates.length } }
  })
}
