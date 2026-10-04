import { promoteCandidates } from '../../../../services/product-comparison.service'
import { success } from '../../../../utils/response'
import { readValidated } from '../../../../utils/validate'
import { promoteSchema } from '../../../../utils/schemas'

// POST /api/v1/product-comparisons/:id/promote — push SELECTED candidates into the product master.
export default defineEventHandler(async (event) => {
  const body = await readValidated(event, promoteSchema)
  return success(await promoteCandidates(getRouterParam(event, 'id')!, body.items), 'Kandidat dijadikan master product')
})
