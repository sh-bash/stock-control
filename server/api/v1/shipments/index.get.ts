import { listShipments } from '../../../repositories/shipment.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listShipments()
  return success(rows)
})
