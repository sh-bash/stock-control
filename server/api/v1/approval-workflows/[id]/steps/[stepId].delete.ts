import { deleteStep } from '../../../../../repositories/approval-workflow.repository'
import { success, failure } from '../../../../../utils/response'

export default defineEventHandler(async (event) => {
  const stepId = getRouterParam(event, 'stepId')!
  const rows = await deleteStep(stepId)
  if (!rows[0]) return failure('Step tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0], 'Step dihapus')
})
