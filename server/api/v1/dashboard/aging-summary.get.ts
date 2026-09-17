import { listActiveLayersForAging } from '../../../repositories/dashboard.repository'
import { success } from '../../../utils/response'

const BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const

function bucketFor(ageDays: number): (typeof BUCKETS)[number] {
  if (ageDays <= 30) return '0-30'
  if (ageDays <= 60) return '31-60'
  if (ageDays <= 90) return '61-90'
  return '90+'
}

// Donut chart data: qty and value per aging bucket. Reads stock_layers
// directly (index-friendly: status is part of the Fase 3 composite index),
// per the confirmed decision that no dedicated aging materialized table
// exists yet.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined

  const layers = await listActiveLayersForAging(warehouseId)
  const now = new Date()

  const buckets: Record<string, { qty: number; value: number }> = {
    '0-30': { qty: 0, value: 0 },
    '31-60': { qty: 0, value: 0 },
    '61-90': { qty: 0, value: 0 },
    '90+': { qty: 0, value: 0 },
  }

  for (const layer of layers) {
    const ageDays = Math.floor((now.getTime() - new Date(layer.receive_date).getTime()) / (1000 * 60 * 60 * 24))
    const bucket = bucketFor(ageDays)
    const qty = Number(layer.qty_remaining)
    buckets[bucket].qty += qty
    buckets[bucket].value += qty * Number(layer.hpp)
  }

  return success({
    buckets: BUCKETS.map((label) => ({ label, ...buckets[label] })),
  })
})
