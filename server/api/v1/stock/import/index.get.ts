import { listImportBatches } from '../../../../services/stock-import.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async () => success(await listImportBatches()))
