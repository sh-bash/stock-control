import { listSnapshots, findLatestSnapshotDate } from '../../../repositories/stock-valuation.repository'
import { resolveProductIdsForCategory } from '../../../repositories/report.repository'
import { success } from '../../../utils/response'

// GET /api/v1/reports/inventory-valuation
//   ?product_id=&warehouse_id=&category_id=&date_from=&date_to=
// Reads from stock_valuation_snapshot, populated by the
// stock-valuation-snapshot job (daily). If no date range is given, defaults
// to the latest snapshot date on record.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const productId = typeof q.product_id === 'string' ? q.product_id : undefined
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const categoryId = typeof q.category_id === 'string' ? q.category_id : undefined
  let dateFrom = typeof q.date_from === 'string' ? q.date_from : undefined
  let dateTo = typeof q.date_to === 'string' ? q.date_to : undefined

  if (!dateFrom && !dateTo) {
    const [latest] = await findLatestSnapshotDate()
    if (!latest?.max) {
      return success({
        filters: { product_id: productId, warehouse_id: warehouseId, category_id: categoryId },
        snapshots: [],
        summary: { total_qty_on_hand: 0, total_value: 0 },
        message: 'Belum ada snapshot. Jalankan job stock-valuation-snapshot dulu.',
      })
    }
    dateFrom = latest.max
    dateTo = latest.max
  }

  let snapshots = await listSnapshots({ productId, warehouseId, dateFrom, dateTo })

  if (categoryId && !productId) {
    const productIds = new Set(await resolveProductIdsForCategory(categoryId))
    snapshots = snapshots.filter((s) => productIds.has(s.product_id))
  }

  const summary = snapshots.reduce(
    (acc, s) => ({
      total_qty_on_hand: acc.total_qty_on_hand + Number(s.qty_on_hand),
      total_value: acc.total_value + Number(s.total_value),
    }),
    { total_qty_on_hand: 0, total_value: 0 },
  )

  return success({
    filters: { product_id: productId, warehouse_id: warehouseId, category_id: categoryId, date_from: dateFrom, date_to: dateTo },
    snapshots,
    summary,
  })
})
