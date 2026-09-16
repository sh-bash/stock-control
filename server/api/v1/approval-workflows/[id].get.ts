import { findWorkflow, listSteps } from '../../../repositories/approval-workflow.repository'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const workflow = await findWorkflow(id)
  if (!workflow) return failure('Workflow tidak ditemukan', 'NOT_FOUND', 404)
  const steps = await listSteps(id)
  return success({ ...workflow, steps })
})
