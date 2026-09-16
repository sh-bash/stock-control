import { listReceivings } from '../../../repositories/receiving.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listReceivings()
  return success(rows)
})
