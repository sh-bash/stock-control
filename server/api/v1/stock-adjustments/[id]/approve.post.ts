import { z } from 'zod'
import { approveAdjustment } from '../../../../services/stock-adjustment.service'
import { success } from '../../../../utils/response'

const schema = z.object({ note: z.string().optional() })

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as { sub: string }
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event).catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { success: false, data: null, message: 'Payload tidak valid', meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() } },
    })
  }
  const adjustment = await approveAdjustment(id, auth.sub, parsed.data.note)
  return success(adjustment)
})
