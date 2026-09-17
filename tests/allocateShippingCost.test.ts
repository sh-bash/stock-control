import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../server/db/client'
import {
  expeditions,
  products,
  purchaseOrderItems,
  purchaseOrders,
  roles,
  shipmentItems,
  shipments,
  suppliers,
  users,
  warehouses,
} from '../server/db/schema'
import { allocateShippingCost } from '../server/services/shipment.service'

// Integration test against the real dev database — builds the full FK chain
// (expedition/supplier/role/user/warehouse/product/PO/PO items/shipment)
// needed to exercise allocateShippingCost end to end, then tears it down.

const suffix = randomUUID().slice(0, 8)
let expeditionId: string
let supplierId: string
let roleId: string
let userId: string
let warehouseId: string
let productAId: string
let productBId: string
let poId: string
let poItemAId: string
let poItemBId: string

beforeAll(async () => {
  const [exp] = await db.insert(expeditions).values({ name: `Test Expedition ${suffix}` }).returning()
  expeditionId = exp.id
  const [sup] = await db.insert(suppliers).values({ name: `Test Supplier ${suffix}` }).returning()
  supplierId = sup.id
  const [role] = await db.insert(roles).values({ name: `test-role-${suffix}` }).returning()
  roleId = role.id
  const [user] = await db
    .insert(users)
    .values({ name: `Test User ${suffix}`, email: `test-${suffix}@example.com`, password_hash: 'x', role_id: roleId })
    .returning()
  userId = user.id
  const [wh] = await db.insert(warehouses).values({ code: `T-WH-SC-${suffix}`, name: `WH ${suffix}` }).returning()
  warehouseId = wh.id
  const [pa] = await db.insert(products).values({ sku: `T-SC-A-${suffix}`, name: `Product A ${suffix}` }).returning()
  productAId = pa.id
  const [pb] = await db.insert(products).values({ sku: `T-SC-B-${suffix}`, name: `Product B ${suffix}` }).returning()
  productBId = pb.id
  const [po] = await db
    .insert(purchaseOrders)
    .values({ no_po: `T-PO-${suffix}`, supplier_id: supplierId, warehouse_id: warehouseId, order_date: '2026-01-01', created_by: userId })
    .returning()
  poId = po.id
  const [poItemA] = await db
    .insert(purchaseOrderItems)
    .values({ po_id: poId, product_id: productAId, qty_order: '10', unit_price: '1000' })
    .returning()
  poItemAId = poItemA.id
  const [poItemB] = await db
    .insert(purchaseOrderItems)
    .values({ po_id: poId, product_id: productBId, qty_order: '20', unit_price: '2000' })
    .returning()
  poItemBId = poItemB.id
})

afterAll(async () => {
  await db.delete(shipmentItems).where(eq(shipmentItems.shipment_id, currentShipmentId ?? randomUUID()))
  await db.delete(shipments).where(eq(shipments.id, currentShipmentId ?? randomUUID()))
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.po_id, poId))
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId))
  await db.delete(products).where(eq(products.id, productAId))
  await db.delete(products).where(eq(products.id, productBId))
  await db.delete(warehouses).where(eq(warehouses.id, warehouseId))
  await db.delete(users).where(eq(users.id, userId))
  await db.delete(roles).where(eq(roles.id, roleId))
  await db.delete(suppliers).where(eq(suppliers.id, supplierId))
  await db.delete(expeditions).where(eq(expeditions.id, expeditionId))
})

let currentShipmentId: string | undefined

async function makeShipment(method: 'per_qty' | 'per_value' | 'per_weight', totalCost: number) {
  const [shipment] = await db
    .insert(shipments)
    .values({
      no_shipment: `T-SHP-${suffix}-${method}`,
      expedition_id: expeditionId,
      ship_date: '2026-01-02',
      total_shipping_cost: totalCost.toString(),
      allocation_method: method,
    })
    .returning()
  currentShipmentId = shipment.id
  await db.insert(shipmentItems).values([
    { shipment_id: shipment.id, po_item_id: poItemAId, qty_shipped: '10', weight: '5' },
    { shipment_id: shipment.id, po_item_id: poItemBId, qty_shipped: '20', weight: '15' },
  ])
  return shipment.id
}

describe('allocateShippingCost (§6.3)', () => {
  it('allocates per_qty: cost split evenly per unit regardless of value/weight', async () => {
    const shipmentId = await makeShipment('per_qty', 300)
    const results = await allocateShippingCost(shipmentId)
    // total qty = 30, cost/unit = 10 for every item
    for (const r of results as any[]) {
      expect(Number(r.allocated_shipping_cost_per_unit)).toBeCloseTo(10, 6)
    }
    await db.delete(shipmentItems).where(eq(shipmentItems.shipment_id, shipmentId))
    await db.delete(shipments).where(eq(shipments.id, shipmentId))
  })

  it('allocates per_value: cost split proportional to qty*unit_price', async () => {
    const shipmentId = await makeShipment('per_value', 500)
    const results = await allocateShippingCost(shipmentId) as any[]
    // A: value=10*1000=10000, B: value=20*2000=40000, total=50000
    // A gets 500*10000/50000=100 total -> /10 units = 10/unit
    // B gets 500*40000/50000=400 total -> /20 units = 20/unit
    const itemA = results.find((r) => r.po_item_id === poItemAId)
    const itemB = results.find((r) => r.po_item_id === poItemBId)
    expect(Number(itemA.allocated_shipping_cost_per_unit)).toBeCloseTo(10, 6)
    expect(Number(itemB.allocated_shipping_cost_per_unit)).toBeCloseTo(20, 6)
    await db.delete(shipmentItems).where(eq(shipmentItems.shipment_id, shipmentId))
    await db.delete(shipments).where(eq(shipments.id, shipmentId))
  })

  it('allocates per_weight: cost split proportional to weight', async () => {
    const shipmentId = await makeShipment('per_weight', 200)
    const results = await allocateShippingCost(shipmentId) as any[]
    // A: weight=5, B: weight=15, total=20
    // A gets 200*5/20=50 total -> /10 units = 5/unit
    // B gets 200*15/20=150 total -> /20 units = 7.5/unit
    const itemA = results.find((r) => r.po_item_id === poItemAId)
    const itemB = results.find((r) => r.po_item_id === poItemBId)
    expect(Number(itemA.allocated_shipping_cost_per_unit)).toBeCloseTo(5, 6)
    expect(Number(itemB.allocated_shipping_cost_per_unit)).toBeCloseTo(7.5, 6)
    await db.delete(shipmentItems).where(eq(shipmentItems.shipment_id, shipmentId))
    await db.delete(shipments).where(eq(shipments.id, shipmentId))
  })

  it('rejects an unrecognized allocation_method', async () => {
    const [shipment] = await db
      .insert(shipments)
      .values({
        no_shipment: `T-SHP-${suffix}-bad`,
        expedition_id: expeditionId,
        ship_date: '2026-01-02',
        total_shipping_cost: '100',
        allocation_method: 'per_bogus',
      })
      .returning()
    currentShipmentId = shipment.id
    await db.insert(shipmentItems).values([{ shipment_id: shipment.id, po_item_id: poItemAId, qty_shipped: '10' }])

    await expect(allocateShippingCost(shipment.id)).rejects.toMatchObject({
      data: { meta: { code: 'INVALID_ALLOCATION_METHOD' } },
    })

    await db.delete(shipmentItems).where(eq(shipmentItems.shipment_id, shipment.id))
    await db.delete(shipments).where(eq(shipments.id, shipment.id))
  })
})
