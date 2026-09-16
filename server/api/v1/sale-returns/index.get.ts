import { listReturns } from '../../../repositories/sale-return.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listReturns()
  return success(rows)
})
