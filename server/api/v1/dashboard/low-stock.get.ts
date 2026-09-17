import { listStockSummaryForLowStockCheck } from '../../../repositories/dashboard.repository'
import { resolveEffectiveSettings } from '../../../repositories/product-stock-settings.repository'
import { success } from '../../../utils/response'

// Products where qty_on_hand has crossed min_stock (danger) or
// reorder_point (warning) — same resolution logic as the Fase 5
// notification hook, just listing instead of notifying.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined

  const summaries = await listStockSummaryForLowStockCheck(warehouseId)
  const alerts = []

  for (const summary of summaries) {
    const settings = await resolveEffectiveSettings(summary.product_id, summary.warehouse_id)
    if (!settings) continue

    const qtyOnHand = Number(summary.qty_on_hand)
    let severity: 'danger' | 'warning' | null = null
    if (settings.min_stock != null && qtyOnHand <= Number(settings.min_stock)) {
      severity = 'danger'
    } else if (settings.reorder_point != null && qtyOnHand <= Number(settings.reorder_point)) {
      severity = 'warning'
    }
    if (!severity) continue

    alerts.push({
      product_id: summary.product_id,
      warehouse_id: summary.warehouse_id,
      qty_on_hand: qtyOnHand,
      min_stock: settings.min_stock,
      reorder_point: settings.reorder_point,
      severity,
    })
  }

  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1))

  return success({ alerts })
})
