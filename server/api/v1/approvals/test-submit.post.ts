import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createApprovalInstance } from '../../../services/approval.service'
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
  document_id: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }

  const documentId = parsed.data.document_id ?? randomUUID()
  const instance = await createApprovalInstance(parsed.data.document_type, documentId)
  return success(instance, 'Dummy document submitted for approval')
})
