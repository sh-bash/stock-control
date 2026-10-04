import { listShipmentReport } from '../../../repositories/procurement-analytics.repository'
import { success } from '../../../utils/response'

// GET /api/v1/reports/shipment?date_from=&date_to=&expedition_id=
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const str = (k: string) => (typeof q[k] === 'string' && q[k] ? (q[k] as string) : undefined)
  const rows = await listShipmentReport({ dateFrom: str('date_from'), dateTo: str('date_to'), expeditionId: str('expedition_id') })

  const lines = rows.map((r: any) => ({
    ...r,
    total_weight: r.total_weight == null ? null : Number(r.total_weight),
    total_volume: r.total_volume == null ? null : Number(r.total_volume),
    total_shipping_cost: Number(r.total_shipping_cost),
    total_qty: Number(r.total_qty),
    cost_per_kg: r.cost_per_kg == null ? null : Number(r.cost_per_kg),
  }))
  const totalWeight = lines.reduce((s: number, r: any) => s + (r.total_weight ?? 0), 0)
  const totalVolume = lines.reduce((s: number, r: any) => s + (r.total_volume ?? 0), 0)
  const totalCost = lines.reduce((s: number, r: any) => s + r.total_shipping_cost, 0)
  return success({
    summary: {
      total_shipments: lines.length,
      total_weight_kg: totalWeight,
      total_volume_cbm: totalVolume,
      total_shipping_cost: totalCost,
      avg_cost_per_kg: totalWeight > 0 ? totalCost / totalWeight : null,
    },
    lines,
  })
})
