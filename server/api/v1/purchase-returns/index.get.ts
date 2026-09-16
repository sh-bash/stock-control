import { listReturns } from '../../../repositories/purchase-return.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listReturns()
  return success(rows)
})
