import { submitReceiving } from '../../../../services/receiving.service'
import { success } from '../../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const result = await submitReceiving(id)
  return success(result, 'Receiving submitted for approval')
})
