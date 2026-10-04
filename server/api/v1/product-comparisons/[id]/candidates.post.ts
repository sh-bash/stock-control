import { addCandidate } from '../../../../services/product-comparison.service'
import { success } from '../../../../utils/response'
import { readValidated } from '../../../../utils/validate'
import { candidateSchema } from '../../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, candidateSchema)
  return success(await addCandidate(getRouterParam(event, 'id')!, body))
})
