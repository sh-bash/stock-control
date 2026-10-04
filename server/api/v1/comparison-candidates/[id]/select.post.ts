import { z } from 'zod'
import { setCandidateSelected } from '../../../../services/product-comparison.service'
import { success } from '../../../../utils/response'
import { readValidated } from '../../../../utils/validate'

export default defineEventHandler(async (event) => {
  const { selected } = await readValidated(event, z.object({ selected: z.boolean() }))
  return success(await setCandidateSelected(getRouterParam(event, 'id')!, selected))
})
