import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import { purchaseOrderItems } from '../db/schema'
import { eq } from 'drizzle-orm'
import {
  addPoRef,
  createShipment,
  createShipmentItem,
  findShipment,
  listShipmentItems,
  setAllocatedCost,
} from '../repositories/shipment.repository'
import { failure } from '../utils/response'

export interface CreateShipmentItemInput {
  po_item_id: string
  qty_shipped: number
  weight?: number
}

export async function createShipmentWithItems(input: {
  expedition_id: string
  ship_date: string
  total_shipping_cost: number
  allocation_method: 'per_qty' | 'per_value' | 'per_weight'
  po_ids: string[]
  items: CreateShipmentItemInput[]
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

  const [shipment] = await createShipment({
    no_shipment: noShipment,
    expedition_id: input.expedition_id,
    ship_date: input.ship_date,
    total_shipping_cost: input.total_shipping_cost.toString(),
    allocation_method: input.allocation_method,
    status: 'draft',
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
