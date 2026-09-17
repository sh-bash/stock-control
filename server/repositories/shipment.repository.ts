import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { shipments, shipmentPoRef, shipmentItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = {
  no_shipment: shipments.no_shipment,
  ship_date: shipments.ship_date,
  status: shipments.status,
}

export function listShipments() {
  return db.select().from(shipments)
}

export function listShipmentsPaged(opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string; status?: string }) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: shipments.status, value: opts.status })
  return listPaged(shipments, {
    ...opts,
    searchColumns: [shipments.no_shipment],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || shipments.ship_date,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
  })
}

export function findShipment(id: string) {
  return db.query.shipments.findFirst({ where: eq(shipments.id, id) })
}

export function createShipment(values: {
  no_shipment: string
  expedition_id: string
  ship_date: string
  total_shipping_cost: string
  allocation_method: string
  status?: string
}) {
  return db.insert(shipments).values(values).returning()
}

export function updateShipment(id: string, values: Record<string, unknown>) {
  return db
    .update(shipments)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(shipments.id, id))
    .returning()
}

export function deleteShipment(id: string) {
  return db.delete(shipments).where(eq(shipments.id, id)).returning()
}

export function addPoRef(shipmentId: string, poId: string) {
  return db.insert(shipmentPoRef).values({ shipment_id: shipmentId, po_id: poId }).returning()
}

export function listPoRefs(shipmentId: string) {
  return db.select().from(shipmentPoRef).where(eq(shipmentPoRef.shipment_id, shipmentId))
}

export function listShipmentItems(shipmentId: string) {
  return db.select().from(shipmentItems).where(eq(shipmentItems.shipment_id, shipmentId))
}

export function findShipmentItem(id: string) {
  return db.query.shipmentItems.findFirst({ where: eq(shipmentItems.id, id) })
}

export function createShipmentItem(values: {
  shipment_id: string
  po_item_id: string
  qty_shipped: string
  weight?: string | null
}) {
  return db.insert(shipmentItems).values(values).returning()
}

export function setAllocatedCost(itemId: string, costPerUnit: string) {
  return db
    .update(shipmentItems)
    .set({ allocated_shipping_cost_per_unit: costPerUnit, updated_at: new Date() })
    .where(eq(shipmentItems.id, itemId))
    .returning()
}

export function deleteShipmentItem(id: string) {
  return db.delete(shipmentItems).where(eq(shipmentItems.id, id)).returning()
}
