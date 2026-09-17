import {
  listDirectSaleLines,
  listDeliveryOrderSaleLines,
  resolveProductIdsForCategory,
} from '../../../repositories/report.repository'
import { success } from '../../../utils/response'

// GET /api/v1/reports/sale
//   ?customer_id=&warehouse_id=&product_id=&category_id=&date_from=&date_to=
//
// Merges the two places §6.4 records a completed sale's cost:
// - use_do=false: stock_ledger.hpp_used on the 'delivery' entry the SO
//   confirm itself posted (see listDirectSaleLines)
// - use_do=true: delivery_order_items.cogs_per_unit, set when the DO was
//   approved (see listDeliveryOrderSaleLines)
// revenue = qty * sell_price, cogs = qty * cogs_per_unit, margin = the
// difference — computed per line and summed for the report total.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const customerId = typeof q.customer_id === 'string' ? q.customer_id : undefined
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const productId = typeof q.product_id === 'string' ? q.product_id : undefined
  const categoryId = typeof q.category_id === 'string' ? q.category_id : undefined
  const dateFrom = typeof q.date_from === 'string' ? q.date_from : undefined
  const dateTo = typeof q.date_to === 'string' ? q.date_to : undefined

  const productIds = categoryId && !productId ? await resolveProductIdsForCategory(categoryId) : undefined
  const filters = { customerId, warehouseId, productId, dateFrom, dateTo, productIds }

  const [directLines, doLines] = await Promise.all([
    listDirectSaleLines(filters),
    listDeliveryOrderSaleLines(filters),
  ])

  const lines = [
    ...directLines.map((l) => ({ ...l, source_type: 'so' as const, do_id: null, no_do: null })),
    ...doLines.map((l) => ({ ...l, source_type: 'do' as const })),
  ].map((l) => {
    const qty = Number(l.qty)
    const sellPrice = Number(l.sell_price)
    const cogsPerUnit = l.cogs_per_unit != null ? Number(l.cogs_per_unit) : 0
    const revenue = qty * sellPrice
    const cogs = qty * cogsPerUnit
    return {
      ...l,
      qty,
      sell_price: sellPrice,
      cogs_per_unit: cogsPerUnit,
      revenue,
      cogs,
      margin: revenue - cogs,
    }
  })

  const summary = lines.reduce(
    (acc, l) => ({
      total_revenue: acc.total_revenue + l.revenue,
      total_cogs: acc.total_cogs + l.cogs,
      total_margin: acc.total_margin + l.margin,
    }),
    { total_revenue: 0, total_cogs: 0, total_margin: 0 },
  )

  return success({
    filters: { customer_id: customerId, warehouse_id: warehouseId, product_id: productId, category_id: categoryId, date_from: dateFrom, date_to: dateTo },
    lines,
    summary,
  })
})
