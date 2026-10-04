import { describe, expect, it } from 'vitest'
import { decideAction, normalizeRows } from '../server/services/stock-import.service'

describe('normalizeRows', () => {
  it('maps flexible headers, parses id-ID numbers and skips blank lines', () => {
    const rows = normalizeRows([
      { SKU: 'A-1', Gudang: 'WH-A', Qty: '1.250,5', HPP: 'x' },
      { sku: '', warehouse: '', qty: '' },
      { 'Kode Produk': 'B-2', warehouse_code: 'WH-B', Stok: 10, Cost: '2500.75' },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ row_no: 2, sku: 'A-1', warehouse: 'WH-A', qty: 1250.5, hpp: null })
    expect(rows[1]).toMatchObject({ row_no: 4, sku: 'B-2', qty: 10, hpp: 2500.75 })
  })
})

describe('decideAction', () => {
  it('treats an untouched product+warehouse as opening balance', () => {
    expect(decideAction({ qtyBefore: 0, hasHistory: false, qtyImport: 40 })).toBe('opening_balance')
  })
  it('records a positive difference as saldo in and a negative one as saldo minus', () => {
    expect(decideAction({ qtyBefore: 10, hasHistory: true, qtyImport: 25 })).toBe('adjust_in')
    expect(decideAction({ qtyBefore: 10, hasHistory: true, qtyImport: 4 })).toBe('adjust_out')
  })
  it('is not an opening balance once the product has history, even at zero stock', () => {
    expect(decideAction({ qtyBefore: 0, hasHistory: true, qtyImport: 5 })).toBe('adjust_in')
  })
  it('leaves matching quantities alone', () => {
    expect(decideAction({ qtyBefore: 7, hasHistory: true, qtyImport: 7 })).toBe('unchanged')
    expect(decideAction({ qtyBefore: 0, hasHistory: false, qtyImport: 0 })).toBe('unchanged')
  })
})
