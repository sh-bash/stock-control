import { listTransfers } from '../../../repositories/stock-transfer.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listTransfers()
  return success(rows)
})
