import { findInstance, listLogs } from '../../../repositories/approval-instance.repository'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const instance = await findInstance(id)
  if (!instance) return failure('Approval instance tidak ditemukan', 'NOT_FOUND', 404)
  const logs = await listLogs(id)
  return success({ ...instance, logs })
})
