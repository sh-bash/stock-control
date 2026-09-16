import { listSettings } from '../../../repositories/product-stock-settings.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const rows = await listSettings()
  return success(rows)
})
