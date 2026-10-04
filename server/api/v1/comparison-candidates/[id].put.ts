import { editCandidate } from '../../../services/product-comparison.service'
import { success } from '../../../utils/response'
import { readValidated } from '../../../utils/validate'
import { candidateSchema } from '../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, candidateSchema.partial())
  return success(await editCandidate(getRouterParam(event, 'id')!, body))
})
