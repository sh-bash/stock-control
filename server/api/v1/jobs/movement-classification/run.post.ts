import { runMovementClassificationJob } from '../../../../jobs/movement-classification.job'
import { success } from '../../../../utils/response'

export default defineEventHandler(async () => {
  const result = await runMovementClassificationJob()
  return success(result, 'movement-classification job executed')
})
