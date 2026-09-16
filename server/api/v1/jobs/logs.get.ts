import { listJobLogs } from '../../../repositories/job-log.repository'
import { success } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const jobName = typeof query.job_name === 'string' ? query.job_name : undefined
  const rows = await listJobLogs(jobName)
  return success(rows)
})
