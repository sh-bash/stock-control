import { getImportBatch } from '../../../../services/stock-import.service'
import { success, failure } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const batch = await getImportBatch(getRouterParam(event, 'id')!)
  if (!batch) return failure('Batch import tidak ditemukan', 'NOT_FOUND', 404)
  return success(batch)
})
