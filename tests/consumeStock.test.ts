import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../server/db/client'
import { products, stockLayers, stockLedger, stockSummary, warehouses } from '../server/db/schema'
import { eq } from 'drizzle-orm'
import { consumeStock } from '../server/services/stock.service'

// Integration tests against the real dev database (same pattern used to
// manually verify every prior phase in this project). Each test creates its
// own product+warehouse so it never collides with seeded/live data, and all
// rows are removed in afterAll.

const suffix = randomUUID().slice(0, 8)
let warehouseId: string
let productId: string

async function createLayer(qty: number, hpp: number, receiveDate: string) {
  const [layer] = await db
    .insert(stockLayers)
    .values({
      product_id: productId,
      warehouse_id: warehouseId,
      source_type: 'receiving',
      source_id: randomUUID(),
      receive_date: receiveDate,
      qty_original: qty.toString(),
      qty_remaining: qty.toString(),
      hpp: hpp.toString(),
    })
    .returning()
  return layer
}

async function seedSummary(qtyOnHand: number, totalValue: number) {
  await db.insert(stockSummary).values({
    product_id: productId,
    warehouse_id: warehouseId,
    qty_on_hand: qtyOnHand.toString(),
    qty_reserved: '0',
    qty_available: qtyOnHand.toString(),
    total_value: totalValue.toString(),
  })
}

async function getSummary() {
  const [row] = await db
    .select()
    .from(stockSummary)
    .where(eq(stockSummary.product_id, productId))
  return row
}

beforeAll(async () => {
  const [wh] = await db
    .insert(warehouses)
    .values({ code: `T-WH-${suffix}`, name: `Test Warehouse ${suffix}` })
    .returning()
  warehouseId = wh.id

  const [p] = await db
    .insert(products)
    .values({ sku: `T-SKU-${suffix}`, name: `Test Product ${suffix}` })
    .returning()
  productId = p.id
})

afterAll(async () => {
  await db.delete(stockLedger).where(eq(stockLedger.product_id, productId))
  await db.delete(stockSummary).where(eq(stockSummary.product_id, productId))
  await db.delete(stockLayers).where(eq(stockLayers.product_id, productId))
  await db.delete(products).where(eq(products.id, productId))
  await db.delete(warehouses).where(eq(warehouses.id, warehouseId))
})

describe('consumeStock (§6.1 FIFO core)', () => {
  it('consumes qty exactly matching a single layer (qty pas habis)', async () => {
    const layer = await createLayer(10, 1000, '2026-01-01')
    await seedSummary(10, 10 * 1000)

    const cogsPerUnit = await db.transaction((tx) =>
      consumeStock(tx, {
        product_id: productId,
        warehouse_id: warehouseId,
        qty_needed: 10,
        transaction_type: 'delivery',
        reference_type: 'test',
        reference_id: randomUUID(),
      }),
    )

    expect(cogsPerUnit).toBe(1000)

    const [refreshedLayer] = await db.select().from(stockLayers).where(eq(stockLayers.id, layer.id))
    expect(Number(refreshedLayer.qty_remaining)).toBe(0)
    expect(refreshedLayer.status).toBe('exhausted')

    const summary = await getSummary()
    expect(Number(summary.qty_on_hand)).toBe(0)
    expect(Number(summary.total_value)).toBe(0)

    // reset for next test
    await db.delete(stockLedger).where(eq(stockLedger.product_id, productId))
    await db.delete(stockSummary).where(eq(stockSummary.product_id, productId))
    await db.delete(stockLayers).where(eq(stockLayers.product_id, productId))
  })

  it('throws INSUFFICIENT_STOCK and rolls back when qty_needed exceeds available (qty kurang)', async () => {
    await createLayer(5, 1000, '2026-01-01')
    await seedSummary(5, 5 * 1000)

    await expect(
      db.transaction((tx) =>
        consumeStock(tx, {
          product_id: productId,
          warehouse_id: warehouseId,
          qty_needed: 8,
          transaction_type: 'delivery',
          reference_type: 'test',
          reference_id: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ data: { meta: { code: 'INSUFFICIENT_STOCK' } } })

    // Rolled back: layer and summary must be untouched.
    const [layer] = await db.select().from(stockLayers).where(eq(stockLayers.product_id, productId))
    expect(Number(layer.qty_remaining)).toBe(5)
    const summary = await getSummary()
    expect(Number(summary.qty_on_hand)).toBe(5)

    await db.delete(stockLedger).where(eq(stockLedger.product_id, productId))
    await db.delete(stockSummary).where(eq(stockSummary.product_id, productId))
    await db.delete(stockLayers).where(eq(stockLayers.product_id, productId))
  })

  it('consumes across multiple layers in FIFO order with weighted-average cogs', async () => {
    // Oldest layer first: 5 units @ 1000, then 10 units @ 1500.
    const layer1 = await createLayer(5, 1000, '2026-01-01')
    const layer2 = await createLayer(10, 1500, '2026-01-05')
    await seedSummary(15, 5 * 1000 + 10 * 1500)

    // Needs 12: fully drains layer1 (5) then takes 7 from layer2.
    const cogsPerUnit = await db.transaction((tx) =>
      consumeStock(tx, {
        product_id: productId,
        warehouse_id: warehouseId,
        qty_needed: 12,
        transaction_type: 'delivery',
        reference_type: 'test',
        reference_id: randomUUID(),
      }),
    )

    const expectedTotalCost = 5 * 1000 + 7 * 1500
    expect(cogsPerUnit).toBeCloseTo(expectedTotalCost / 12, 6)

    const [refreshed1] = await db.select().from(stockLayers).where(eq(stockLayers.id, layer1.id))
    const [refreshed2] = await db.select().from(stockLayers).where(eq(stockLayers.id, layer2.id))
    expect(Number(refreshed1.qty_remaining)).toBe(0)
    expect(refreshed1.status).toBe('exhausted')
    expect(Number(refreshed2.qty_remaining)).toBe(3)
    expect(refreshed2.status).toBe('active')

    const summary = await getSummary()
    expect(Number(summary.qty_on_hand)).toBe(3)
    const originalTotalValue = 5 * 1000 + 10 * 1500
    expect(Number(summary.total_value)).toBeCloseTo(originalTotalValue - expectedTotalCost, 6)
  })
})
