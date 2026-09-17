import { getPurchaseSaleTrend } from '../../../repositories/dashboard.repository'
import { success } from '../../../utils/response'

function isoDateNDaysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// GET /api/v1/dashboard/purchase-sale-trend?date_from=&date_to=&warehouse_id=
// Defaults to the trailing 30 days when no period is given.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const dateFrom = typeof q.date_from === 'string' ? q.date_from : isoDateNDaysAgo(30)
  const dateTo = typeof q.date_to === 'string' ? q.date_to : isoDateNDaysAgo(0)

  const rows = await getPurchaseSaleTrend({ dateFrom, dateTo, warehouseId })

  return success({
    filters: { date_from: dateFrom, date_to: dateTo, warehouse_id: warehouseId },
    trend: rows.map((r) => ({
      day: r.day,
      purchase_qty: Number(r.purchase_qty),
      purchase_value: Number(r.purchase_value),
      sale_qty: Number(r.sale_qty),
      sale_value: Number(r.sale_value),
    })),
  })
})
