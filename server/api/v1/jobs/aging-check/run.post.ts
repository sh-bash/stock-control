import { runAgingCheckJob } from '../../../../jobs/aging-check.job'
import { success } from '../../../../utils/response'

export default defineEventHandler(async () => {
  const result = await runAgingCheckJob()
  return success(result, 'aging-check job executed')
})
