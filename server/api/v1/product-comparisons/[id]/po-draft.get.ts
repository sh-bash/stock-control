import { getPoDraft } from '../../../../services/product-comparison.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  return success(await getPoDraft(getRouterParam(event, 'id')!))
})
