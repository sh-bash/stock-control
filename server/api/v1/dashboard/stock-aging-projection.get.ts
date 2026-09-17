import {
  listStockSummaryWithWarehouse,
  findOldestActiveLayer,
  findMovementStats,
  findClassification,
} from '../../../repositories/dashboard.repository'
import { success } from '../../../utils/response'

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

// Detail page backing this: per product, qty on hand, oldest active
// layer's age, avg daily out (30d), projected days/date to zero stock
// (§6.6), and its current fast/normal/slow/dead classification. All four
// pieces come from materialized/indexed sources — stock_summary,
// stock_layers (indexed), product_movement_stats, movement_classification.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined

  const summaries = await listStockSummaryWithWarehouse(warehouseId)
  const now = new Date()

  const rows = []
  for (const summary of summaries) {
    const [oldestLayer, stats, classification] = await Promise.all([
      findOldestActiveLayer(summary.product_id, summary.warehouse_id),
      findMovementStats(summary.product_id, summary.warehouse_id),
      findClassification(summary.product_id, summary.warehouse_id),
    ])

    const oldestAgeDays = oldestLayer[0] ? daysBetween(new Date(oldestLayer[0].receive_date), now) : null

    const avgDailyOut = stats?.avg_daily_out_qty_30d != null ? Number(stats.avg_daily_out_qty_30d) : null
    const qtyOnHand = Number(summary.qty_on_hand)

    let projectedDaysToZero: number | null = null
    let projectedZeroDate: string | null = null
    let projectionNote: string | null = null

    if (avgDailyOut != null && avgDailyOut > 0) {
      projectedDaysToZero = Math.round(qtyOnHand / avgDailyOut)
      const zeroDate = new Date(now)
      zeroDate.setDate(zeroDate.getDate() + projectedDaysToZero)
      projectedZeroDate = zeroDate.toISOString().slice(0, 10)
    } else {
      projectionNote = 'Tidak ada proyeksi (Dead Stock)'
    }

    rows.push({
      product_id: summary.product_id,
      warehouse_id: summary.warehouse_id,
      qty_on_hand: qtyOnHand,
      oldest_layer_age_days: oldestAgeDays,
      avg_daily_out_qty_30d: avgDailyOut,
      projected_days_to_zero: projectedDaysToZero,
      projected_zero_date: projectedZeroDate,
      projection_note: projectionNote,
      classification: classification?.classification ?? null,
    })
  }

  return success(rows)
})
