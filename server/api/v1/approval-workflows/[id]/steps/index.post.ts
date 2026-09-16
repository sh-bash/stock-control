import { z } from 'zod'
import { countSteps, createStep, findWorkflow } from '../../../../../repositories/approval-workflow.repository'
import { success, failure } from '../../../../../utils/response'

const schema = z.object({
  approver_type: z.enum(['role', 'user']),
  approver_id: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const workflowId = getRouterParam(event, 'id')!
  const workflow = await findWorkflow(workflowId)
  if (!workflow) return failure('Workflow tidak ditemukan', 'NOT_FOUND', 404)

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }

  const existingSteps = await countSteps(workflowId)
  const nextOrder = existingSteps.length + 1

  const rows = await createStep({
    workflow_id: workflowId,
    step_order: nextOrder,
    approver_type: parsed.data.approver_type,
    approver_id: parsed.data.approver_id,
  })
  return success(rows[0])
})
