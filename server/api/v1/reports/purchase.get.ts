import {
  listOutstandingPurchaseOrders,
  listPurchasePriceHistory,
  resolveProductIdsForCategory,
} from '../../../repositories/report.repository'
import { success } from '../../../utils/response'

// GET /api/v1/reports/purchase
//   ?supplier_id=&warehouse_id=&product_id=&category_id=&date_from=&date_to=
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const supplierId = typeof q.supplier_id === 'string' ? q.supplier_id : undefined
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined
  const productId = typeof q.product_id === 'string' ? q.product_id : undefined
  const categoryId = typeof q.category_id === 'string' ? q.category_id : undefined
  const dateFrom = typeof q.date_from === 'string' ? q.date_from : undefined
  const dateTo = typeof q.date_to === 'string' ? q.date_to : undefined

  const productIds = categoryId && !productId ? await resolveProductIdsForCategory(categoryId) : undefined

  const [outstanding, priceHistory] = await Promise.all([
    listOutstandingPurchaseOrders({ supplierId, warehouseId, dateFrom, dateTo, productId, productIds }),
    listPurchasePriceHistory({ productId, supplierId, dateFrom, dateTo, productIds }),
  ])

  return success({
    filters: { supplier_id: supplierId, warehouse_id: warehouseId, product_id: productId, category_id: categoryId, date_from: dateFrom, date_to: dateTo },
    outstanding_purchase_orders: outstanding,
    price_history: priceHistory,
  })
})
