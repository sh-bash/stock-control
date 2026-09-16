import { z } from 'zod'
import { updateWorkflow } from '../../../repositories/approval-workflow.repository'
import { success, failure } from '../../../utils/response'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const rows = await updateWorkflow(id, parsed.data)
  if (!rows[0]) return failure('Workflow tidak ditemukan', 'NOT_FOUND', 404)
  return success(rows[0])
})
