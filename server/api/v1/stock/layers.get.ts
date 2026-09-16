import { listStockLayers } from '../../../repositories/stock.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rows = await listStockLayers(
    typeof query.product_id === 'string' ? query.product_id : undefined,
    typeof query.warehouse_id === 'string' ? query.warehouse_id : undefined,
  )
  return success(rows)
})
