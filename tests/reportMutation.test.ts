import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../server/db/client'
import { products, stockLedger, warehouses } from '../server/db/schema'
import { getStockCard } from '../server/repositories/report.repository'

// Regression test for a Fase 8 bug found during the Fase 8-10 deep review:
// transaction_date is a timestamp, but the mutation report's date_to filter
// arrives as a bare date string ("2026-09-17"). `new Date(dateTo)` parses to
// that day's UTC midnight, so an unadjusted `lte` silently excluded every
// entry recorded later that same day — i.e. almost all same-day activity.
// Fixed by anchoring date_to to that day's 23:59:59.999Z, mirroring the
// dashboard trend query's existing end-of-day adjustment.

const suffix = randomUUID().slice(0, 8)
let warehouseId: string
let productId: string

beforeAll(async () => {
  const [wh] = await db.insert(warehouses).values({ code: `T-RM-WH-${suffix}`, name: `RM WH ${suffix}` }).returning()
  warehouseId = wh.id
  const [p] = await db.insert(products).values({ sku: `T-RM-SKU-${suffix}`, name: `RM Product ${suffix}` }).returning()
  productId = p.id
})

afterAll(async () => {
  await db.delete(stockLedger).where(eq(stockLedger.product_id, productId))
  await db.delete(products).where(eq(products.id, productId))
  await db.delete(warehouses).where(eq(warehouses.id, warehouseId))
})

describe('getStockCard date_to filter', () => {
  it('includes entries recorded later the same UTC day as date_to', async () => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    // A transaction recorded well after UTC midnight on "today" must still
    // be included when the caller filters date_to=today.
    const lateToday = new Date(`${todayStr}T20:00:00.000Z`)

    await db.insert(stockLedger).values({
      id: randomUUID(),
      product_id: productId,
      warehouse_id: warehouseId,
      transaction_type: 'receiving',
      reference_type: 'test',
      reference_id: randomUUID(),
      transaction_date: lateToday,
      qty_in: '5',
      qty_out: '0',
      running_balance_qty: '5',
      running_balance_value: '5000',
    })

    const rows = await getStockCard({ productId, warehouseId, dateFrom: todayStr, dateTo: todayStr })
    expect(rows.length).toBe(1)
  })
})
