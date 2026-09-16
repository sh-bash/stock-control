import { z } from 'zod'
import { createWorkflow } from '../../../repositories/approval-workflow.repository'
import { success } from '../../../utils/response'

const DOCUMENT_TYPES = [
  'po',
  'receiving',
  'purchase_return',
  'so',
  'do',
  'sale_return',
  'adjustment',
  'transfer',
] as const

const schema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  name: z.string().min(1).max(100),
  is_active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const rows = await createWorkflow(parsed.data)
  return success(rows[0])
})
