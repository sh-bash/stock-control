import { deleteAttachment } from '../../../services/attachment.service'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  return success(await deleteAttachment(getRouterParam(event, 'id')!))
})
