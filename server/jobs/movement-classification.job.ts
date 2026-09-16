import { resolveEffectiveSettings } from '../repositories/product-stock-settings.repository'
import {
  listStockSummaryCombinations,
  sumQtyOutSince,
  findLastOutboundDate,
  findFirstLedgerDate,
  upsertMovementStats,
  upsertMovementClassification,
} from '../repositories/movement-analytics.repository'
import { runJobWithLogging } from './job-runner'

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

// Implements PRD §6.5. Pure recomputation from stock_ledger for every
// product+warehouse combination on record (upserted keyed on
// product_id+warehouse_id in both product_movement_stats and
// movement_classification) — running it twice back to back with no new
// ledger activity in between produces byte-identical rows, satisfying the
// idempotency requirement.
export async function runMovementClassificationJob() {
  return runJobWithLogging('movement-classification', async () => {
    const combinations = await listStockSummaryCombinations()
    const now = new Date()

    for (const combo of combinations) {
      const [sum30, sum90, lastOutbound, firstLedger] = await Promise.all([
        sumQtyOutSince(combo.product_id, combo.warehouse_id, daysAgo(30)),
        sumQtyOutSince(combo.product_id, combo.warehouse_id, daysAgo(90)),
        findLastOutboundDate(combo.product_id, combo.warehouse_id),
        findFirstLedgerDate(combo.product_id, combo.warehouse_id),
      ])

      const avg30d = sum30 / 30
      const avg90d = sum90 / 90

      const referenceDate = lastOutbound ?? firstLedger
      const daysSinceLastMovement = referenceDate ? daysBetween(new Date(referenceDate), now) : null

      await upsertMovementStats({
        product_id: combo.product_id,
        warehouse_id: combo.warehouse_id,
        avg_daily_out_qty_30d: avg30d.toString(),
        avg_daily_out_qty_90d: avg90d.toString(),
        last_movement_date: lastOutbound ? new Date(lastOutbound).toISOString().slice(0, 10) : null,
        days_since_last_movement: daysSinceLastMovement,
        calculated_at: now,
      })

      const settings = await resolveEffectiveSettings(combo.product_id, combo.warehouse_id)

      let classification: 'fast' | 'normal' | 'slow' | 'dead' = 'normal'
      if (settings) {
        const fastThreshold = Number(settings.fast_moving_min_daily_out)
        const slowThreshold = Number(settings.slow_moving_max_daily_out)
        const deadDays = settings.dead_stock_no_movement_days

        if (avg30d >= fastThreshold) {
          classification = 'fast'
        } else if (avg30d === 0 && daysSinceLastMovement !== null && daysSinceLastMovement >= deadDays) {
          classification = 'dead'
        } else if (avg30d <= slowThreshold) {
          classification = 'slow'
        } else {
          classification = 'normal'
        }
      }

      await upsertMovementClassification({
        product_id: combo.product_id,
        warehouse_id: combo.warehouse_id,
        classification,
        calculated_at: now,
      })
    }

    return { rowsProcessed: combinations.length, result: { combinations: combinations.length } }
  })
}
