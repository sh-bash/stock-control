import { updateProductComparison } from '../../../services/product-comparison.service'
import { success } from '../../../utils/response'
import { readValidated } from '../../../utils/validate'
import { comparisonUpdateSchema } from '../../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, comparisonUpdateSchema)
  return success(await updateProductComparison(getRouterParam(event, 'id')!, body))
})
