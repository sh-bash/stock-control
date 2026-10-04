import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import { products, purchaseOrderItems } from '../db/schema'
import { roundCbm, unitVolumeCbm } from '../../utils/volume'
import { eq } from 'drizzle-orm'
import {
  addPoRef,
  createShipment,
  createShipmentItem,
  findShipment,
  listShipmentItems,
  setAllocatedCost,
  updateShipment,
} from '../repositories/shipment.repository'
import { failure } from '../utils/response'

export interface CreateShipmentItemInput {
  po_item_id: string
  qty_shipped: number
  weight?: number
  // Line volume in CBM; computed from the product's packed dimensions when omitted.
  volume?: number
}

export async function createShipmentWithItems(input: {
  expedition_id: string
  ship_date: string
  total_shipping_cost: number
  allocation_method: 'per_qty' | 'per_value' | 'per_weight'
  po_ids: string[]
  items: CreateShipmentItemInput[]
  tracking_no?: string | null
  bl_number?: string | null
  container_no?: string | null
  eta_date?: string | null
  notes?: string | null
}) {
  if (input.po_ids.length === 0) {
    return failure('Shipment harus mereferensikan minimal 1 PO', 'EMPTY_PO_REF', 400)
  }
  if (input.items.length === 0) {
    return failure('Shipment harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }
  if (input.allocation_method === 'per_weight' && input.items.some((i) => !i.weight || i.weight <= 0)) {
    return failure('Semua item wajib punya weight > 0 untuk allocation_method per_weight', 'MISSING_WEIGHT', 400)
  }

  const noShipment = `SHP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  // Weight is recorded on every shipment (kg per line), whichever allocation
  // method is used; the shipment keeps the sum for display/reporting.
  const totalWeight = input.items.reduce((sum, i) => sum + (i.weight ?? 0), 0)

  // Volume per line: typed value wins, else qty × the product's packed unit volume.
  const lineVolumes = new Map<string, number>()
  for (const item of input.items) {
    if (item.volume != null) {
      lineVolumes.set(item.po_item_id, item.volume)
      continue
    }
    const [row] = await db
      .select({ p: products })
      .from(purchaseOrderItems)
      .innerJoin(products, eq(purchaseOrderItems.product_id, products.id))
      .where(eq(purchaseOrderItems.id, item.po_item_id))
    const unit = unitVolumeCbm(row?.p)
    if (unit != null) lineVolumes.set(item.po_item_id, roundCbm(unit * item.qty_shipped))
  }
  const totalVolume = [...lineVolumes.values()].reduce((a, b) => a + b, 0)

  const [shipment] = await createShipment({
    no_shipment: noShipment,
    expedition_id: input.expedition_id,
    ship_date: input.ship_date,
    total_shipping_cost: input.total_shipping_cost.toString(),
    allocation_method: input.allocation_method,
    status: 'draft',
    total_weight: totalWeight > 0 ? totalWeight.toString() : null,
    total_volume: totalVolume > 0 ? roundCbm(totalVolume).toString() : null,
    tracking_no: input.tracking_no ?? null,
    bl_number: input.bl_number ?? null,
    container_no: input.container_no ?? null,
    eta_date: input.eta_date ?? null,
    notes: input.notes ?? null,
  })

  for (const poId of input.po_ids) {
    await addPoRef(shipment.id, poId)
  }

  for (const item of input.items) {
    await createShipmentItem({
      shipment_id: shipment.id,
      po_item_id: item.po_item_id,
      qty_shipped: item.qty_shipped.toString(),
      weight: item.weight != null ? item.weight.toString() : null,
      volume: lineVolumes.has(item.po_item_id) ? lineVolumes.get(item.po_item_id)!.toString() : null,
    })
  }

  const allocated = await allocateShippingCost(shipment.id)
  return { ...shipment, items: allocated }
}

// Implements PRD §6.3 allocateShippingCost — supports per_qty / per_value / per_weight.
export async function allocateShippingCost(shipmentId: string) {
  const shipment = await findShipment(shipmentId)
  if (!shipment) return failure('Shipment tidak ditemukan', 'NOT_FOUND', 404)

  const items = await listShipmentItems(shipmentId)
  if (items.length === 0) return []

  const totalShippingCost = Number(shipment.total_shipping_cost)

  const poItemIds = items.map((i) => i.po_item_id)
  const poItemMap = new Map<string, { unit_price: string }>()
  for (const poItemId of poItemIds) {
    const found = await db.query.purchaseOrderItems.findFirst({ where: eq(purchaseOrderItems.id, poItemId) })
    if (found) poItemMap.set(poItemId, found)
  }

  const results = []

  if (shipment.allocation_method === 'per_qty') {
    const totalQty = items.reduce((sum, i) => sum + Number(i.qty_shipped), 0)
    for (const item of items) {
      const costPerUnit = totalQty > 0 ? totalShippingCost / totalQty : 0
      const [updated] = await setAllocatedCost(item.id, costPerUnit.toString())
      results.push(updated)
    }
  } else if (shipment.allocation_method === 'per_value') {
    const totalValue = items.reduce((sum, i) => {
      const unitPrice = Number(poItemMap.get(i.po_item_id)?.unit_price ?? 0)
      return sum + Number(i.qty_shipped) * unitPrice
    }, 0)
    for (const item of items) {
      const unitPrice = Number(poItemMap.get(item.po_item_id)?.unit_price ?? 0)
      const itemValue = Number(item.qty_shipped) * unitPrice
      const proportion = totalValue > 0 ? itemValue / totalValue : 0
      const costPerUnit = Number(item.qty_shipped) > 0 ? (totalShippingCost * proportion) / Number(item.qty_shipped) : 0
      const [updated] = await setAllocatedCost(item.id, costPerUnit.toString())
      results.push(updated)
    }
  } else if (shipment.allocation_method === 'per_weight') {
    const totalWeight = items.reduce((sum, i) => sum + Number(i.weight ?? 0), 0)
    for (const item of items) {
      const proportion = totalWeight > 0 ? Number(item.weight ?? 0) / totalWeight : 0
      const costPerUnit = Number(item.qty_shipped) > 0 ? (totalShippingCost * proportion) / Number(item.qty_shipped) : 0
      const [updated] = await setAllocatedCost(item.id, costPerUnit.toString())
      results.push(updated)
    }
  } else {
    return failure(`allocation_method "${shipment.allocation_method}" tidak dikenali`, 'INVALID_ALLOCATION_METHOD', 400)
  }

  return results
}

// Shipment lifecycle: draft → in_transit → arrived → completed (one step at a
// time, forward only). Receivings can be created against any shipment, this
// only tracks where the goods physically are.
const SHIPMENT_FLOW = ['draft', 'in_transit', 'arrived', 'completed']

export async function setShipmentStatus(shipmentId: string, status: string) {
  const shipment = await findShipment(shipmentId)
  if (!shipment) return failure('Shipment tidak ditemukan', 'NOT_FOUND', 404)
  const from = SHIPMENT_FLOW.indexOf(shipment.status)
  const to = SHIPMENT_FLOW.indexOf(status)
  if (to < 0) return failure(`Status "${status}" tidak dikenali`, 'INVALID_STATUS', 400)
  if (to !== from + 1) {
    return failure(`Shipment tidak bisa pindah dari "${shipment.status}" ke "${status}"`, 'INVALID_TRANSITION', 400)
  }
  const [row] = await updateShipment(shipmentId, { status })
  return row
}
