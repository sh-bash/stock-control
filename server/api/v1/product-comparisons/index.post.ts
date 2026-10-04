import { createProductComparison } from '../../../services/product-comparison.service'
import { success } from '../../../utils/response'
import { authUserId, readValidated } from '../../../utils/validate'
import { comparisonSchema } from '../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, comparisonSchema)
  return success(await createProductComparison({ ...body, created_by: authUserId(event) }))
})
