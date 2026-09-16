import { getSettings } from '../../../repositories/global-stock-settings.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const row = await getSettings()
  return success(row)
})
