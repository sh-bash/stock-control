import { findShipment, listPoRefs, listShipmentItems } from '../../../repositories/shipment.repository'
import { success, failure } from '../../../utils/response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const shipment = await findShipment(id)
  if (!shipment) return failure('Shipment tidak ditemukan', 'NOT_FOUND', 404)
  const [items, poRefs] = await Promise.all([listShipmentItems(id), listPoRefs(id)])
  return success({ ...shipment, items, po_refs: poRefs })
})
