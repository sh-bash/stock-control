import { z } from 'zod'
import { approveProductRequest } from '../../../../services/product-request.service'
import { success } from '../../../../utils/response'
import { authUserId, readValidated } from '../../../../utils/validate'

export default defineEventHandler(async (event) => {
  const { note } = await readValidated(event, z.object({ note: z.string().optional() }))
  return success(await approveProductRequest(getRouterParam(event, 'id')!, authUserId(event), note))
})
