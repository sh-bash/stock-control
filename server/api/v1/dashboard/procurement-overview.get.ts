import {
  getMonthlyPoValue,
  getOpenPoValue,
  getPipelineCounts,
  getShipmentsInFlight,
  getTopSuppliers,
} from '../../../repositories/procurement-analytics.repository'
import { success } from '../../../utils/response'

const toMap = (rows: { status: string; count: number }[]) =>
  Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]))

// GET /api/v1/dashboard/procurement-overview?warehouse_id=
// Everything the procurement half of the dashboard needs in one round trip.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' && q.warehouse_id ? q.warehouse_id : undefined

  const [pipeline, openPo, monthly, topSuppliers, inFlight] = await Promise.all([
    getPipelineCounts(warehouseId),
    getOpenPoValue(warehouseId),
    getMonthlyPoValue(6, warehouseId),
    getTopSuppliers(90, 5, warehouseId),
    getShipmentsInFlight(8),
  ])

  const orderStatus = Object.fromEntries(pipeline.orders.map((o) => [o.status, { count: Number(o.count), value: Number(o.value) }]))

  return success({
    pipeline: {
      requests: toMap(pipeline.requests),
      comparisons: toMap(pipeline.comparisons),
      orders: Object.fromEntries(Object.entries(orderStatus).map(([k, v]) => [k, v.count])),
      shipments: toMap(pipeline.shipments),
      receivings: toMap(pipeline.receivings),
    },
    order_value_by_status: Object.fromEntries(Object.entries(orderStatus).map(([k, v]) => [k, v.value])),
    open_po: { value: Number(openPo.value), count: Number(openPo.count) },
    monthly_po: monthly.map((m) => ({ month: m.month, value: Number(m.value), count: Number(m.count) })),
    top_suppliers: topSuppliers.map((s) => ({ id: s.id, name: s.name, po_count: Number(s.po_count), value: Number(s.value) })),
    shipments_in_flight: inFlight.map((s: any) => ({
      id: s.id,
      no_shipment: s.no_shipment,
      status: s.status,
      ship_date: s.ship_date,
      eta_date: s.eta_date,
      tracking_no: s.tracking_no,
      expedition_name: s.expedition_name,
      total_weight: s.total_weight == null ? null : Number(s.total_weight),
      total_qty: Number(s.total_qty),
      total_shipping_cost: Number(s.total_shipping_cost),
      overdue: !!s.overdue,
    })),
  })
})
