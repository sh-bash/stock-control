import { listSteps, listWorkflows } from '../../../repositories/approval-workflow.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async () => {
  const workflows = await listWorkflows()
  const withSteps = await Promise.all(
    workflows.map(async (wf) => ({ ...wf, steps: await listSteps(wf.id) })),
  )
  return success(withSteps)
})
