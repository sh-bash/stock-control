import { getStockValueOverview, getStockValueByWarehouse } from '../../../repositories/dashboard.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const warehouseId = typeof q.warehouse_id === 'string' ? q.warehouse_id : undefined

  const [overview] = await getStockValueOverview(warehouseId)
  const byWarehouse = warehouseId ? [] : await getStockValueByWarehouse()

  return success({
    total_value: Number(overview?.total_value ?? 0),
    total_qty_on_hand: Number(overview?.total_qty_on_hand ?? 0),
    product_count: Number(overview?.product_count ?? 0),
    by_warehouse: byWarehouse.map((w) => ({
      warehouse_id: w.warehouse_id,
      total_value: Number(w.total_value),
      total_qty_on_hand: Number(w.total_qty_on_hand),
    })),
  })
})
