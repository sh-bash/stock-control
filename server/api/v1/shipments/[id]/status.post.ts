import { z } from 'zod'
import { setShipmentStatus } from '../../../../services/shipment.service'
import { success } from '../../../../utils/response'
import { readValidated } from '../../../../utils/validate'

export default defineEventHandler(async (event) => {
  const { status } = await readValidated(event, z.object({ status: z.enum(['in_transit', 'arrived', 'completed']) }))
  return success(await setShipmentStatus(getRouterParam(event, 'id')!, status))
})
