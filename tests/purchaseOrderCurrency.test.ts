import { describe, expect, it } from 'vitest'
import { computePoLines } from '../server/services/purchase-order.service'

describe('computePoLines', () => {
  it('converts RMB prices to IDR with the PO rate and keeps the foreign price', () => {
    const r = computePoLines('RMB', 2250.5, [
      { product_id: 'a', qty_order: 10, price: 12.5 },
      { product_id: 'b', qty_order: 2, price: 100 },
    ])
    expect(r.rate).toBe(2250.5)
    expect(r.lines[0].unit_price).toBe(28131.25)
    expect(r.lines[0].price_foreign).toBe(12.5)
    expect(r.total_foreign).toBe(325)
    expect(r.total_idr).toBe(10 * 28131.25 + 2 * 225050)
  })

  it('forces IDR POs to rate 1 with no foreign price', () => {
    const r = computePoLines('IDR', 9999, [{ product_id: 'a', qty_order: 3, price: 5000 }])
    expect(r.rate).toBe(1)
    expect(r.lines[0].price_foreign).toBeNull()
    expect(r.lines[0].unit_price).toBe(5000)
    expect(r.total_foreign).toBeNull()
    expect(r.total_idr).toBe(15000)
  })
})
