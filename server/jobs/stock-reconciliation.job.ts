import { sql } from 'drizzle-orm'
import { db } from '../db/client'
import { stockLayers, stockSummary } from '../db/schema'
import { runJobWithLogging } from './job-runner'

const EPSILON = 0.0005

// Implements §7 Fase 7 point 3: read-only comparison of stock_summary
// against the ground truth (SUM(qty_remaining) per stock_layers) — same
// aggregation stock.service.ts's rebuildStockSummary() uses to actually
// fix drift, but this job never writes; it only detects and logs. Pure
// read + log, so running it any number of times back to back is trivially
// idempotent (each run just re-detects the same drift, if any, and adds
// its own job_execution_logs row — the log itself isn't meant to
// deduplicate, only the underlying data comparison is stable).
export async function runStockReconciliationJob() {
  return runJobWithLogging('stock-reconciliation', async () => {
    const aggregates = await db
      .select({
        product_id: stockLayers.product_id,
        warehouse_id: stockLayers.warehouse_id,
        qty_remaining_sum: sql<string>`COALESCE(SUM(${stockLayers.qty_remaining}), 0)`,
      })
      .from(stockLayers)
      .groupBy(stockLayers.product_id, stockLayers.warehouse_id)

    const aggregateMap = new Map(aggregates.map((a) => [`${a.product_id}:${a.warehouse_id}`, a.qty_remaining_sum]))

    const summaries = await db.select().from(stockSummary)

    const diffs: {
      product_id: string
      warehouse_id: string
      qty_on_hand: string
      layers_sum: string
      diff: number
    }[] = []

    for (const summary of summaries) {
      const key = `${summary.product_id}:${summary.warehouse_id}`
      const layersSum = aggregateMap.get(key) ?? '0'
      const diff = Number(summary.qty_on_hand) - Number(layersSum)
      if (Math.abs(diff) > EPSILON) {
        diffs.push({
          product_id: summary.product_id,
          warehouse_id: summary.warehouse_id,
          qty_on_hand: summary.qty_on_hand,
          layers_sum: layersSum,
          diff,
        })
      }
    }

    const warning =
      diffs.length > 0
        ? `${diffs.length} selisih ditemukan: ${JSON.stringify(diffs).slice(0, 1800)}`
        : null

    return {
      rowsProcessed: summaries.length,
      result: { checked: summaries.length, diffs },
      warning,
    }
  })
}
