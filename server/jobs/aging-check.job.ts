import { listActiveLayers } from '../repositories/stock.repository'
import { resolveEffectiveSettings } from '../repositories/product-stock-settings.repository'
import { findRecentNotification } from '../repositories/notification.repository'
import { createNotification } from '../services/notification.service'
import { runJobWithLogging } from './job-runner'

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Implements PRD §6.7-style trigger driven from §5.1's aging_warning_days /
// aging_danger_days: for every active stock_layer, age = today - receive_date,
// compare against the resolved effective settings. Idempotency: before
// creating a notification, checks whether one of the same type already
// exists for this exact layer (reference_type='stock_layer') created today
// (findRecentNotification) — so running the job twice in the same day (or
// a daily cron that finds the same aged layer again tomorrow's threshold
// hasn't changed) never double-fires. danger takes priority over warning
// when a layer has crossed both.
export async function runAgingCheckJob() {
  return runJobWithLogging('aging-check', async () => {
    const layers = await listActiveLayers()
    const now = new Date()
    const today = startOfToday()
    let notified = 0

    for (const layer of layers) {
      const settings = await resolveEffectiveSettings(layer.product_id, layer.warehouse_id)
      if (!settings) continue

      const ageDays = daysBetween(new Date(layer.receive_date), now)

      let type: 'aging_danger' | 'aging_warning' | null = null
      let severity: 'danger' | 'warning' | null = null

      if (ageDays >= settings.aging_danger_days) {
        type = 'aging_danger'
        severity = 'danger'
      } else if (ageDays >= settings.aging_warning_days) {
        type = 'aging_warning'
        severity = 'warning'
      }

      if (!type || !severity) continue

      const existing = await findRecentNotification(type, 'stock_layer', layer.id, today)
      if (existing) continue

      const notification = await createNotification({
        type,
        severity,
        title: `Stock layer berumur ${ageDays} hari (${type === 'aging_danger' ? 'danger' : 'warning'})`,
        message: `Layer diterima ${layer.receive_date}, sisa qty ${layer.qty_remaining}, sudah berumur ${ageDays} hari.`,
        reference_type: 'stock_layer',
        reference_id: layer.id,
        product_id: layer.product_id,
        warehouse_id: layer.warehouse_id,
      })
      if (notification) notified++
    }

    return { rowsProcessed: layers.length, result: { layersChecked: layers.length, notified } }
  })
}
