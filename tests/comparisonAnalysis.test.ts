import { describe, expect, it } from 'vitest'
import { analyzeCandidates, toIdr, type CandidateInput } from '../server/services/comparison-analysis.service'

const base: CandidateInput = {
  id: 'x',
  request_item_id: null,
  name: 'x',
  price: 10,
  currency: 'RMB',
  lead_time_days: null,
  weight_kg: null,
  length_cm: null,
  width_cm: null,
  height_cm: null,
  pack_length_cm: null,
  pack_width_cm: null,
  pack_height_cm: null,
}

describe('toIdr', () => {
  it('converts RMB with the rate and leaves IDR untouched', () => {
    expect(toIdr(10, 'RMB', 2200)).toBe(22000)
    expect(toIdr(10, 'IDR', 2200)).toBe(10)
  })
})

describe('analyzeCandidates', () => {
  it('normalises RMB and IDR prices to IDR before ranking', () => {
    const res = analyzeCandidates(
      [
        { ...base, id: 'rmb', name: 'RMB', price: 10, currency: 'RMB' }, // 22.000
        { ...base, id: 'idr', name: 'IDR', price: 20000, currency: 'IDR' },
      ],
      2200,
    )
    expect(res.recommended_ids).toEqual(['idr'])
    expect(res.candidates.find((c) => c.id === 'rmb')!.price_idr).toBe(22000)
  })

  it('weighs multiple metrics and ranks the best overall first', () => {
    const res = analyzeCandidates(
      [
        { ...base, id: 'cheap-heavy', name: 'A', price: 10, weight_kg: 5 },
        { ...base, id: 'pricey-light', name: 'B', price: 11, weight_kg: 1 },
      ],
      1,
      { price: 0.3, weight: 0.7, volume: 0, lead_time: 0 },
    )
    expect(res.candidates.find((c) => c.rank === 1)!.id).toBe('pricey-light')
  })

  it('does not penalise a candidate for missing data', () => {
    const res = analyzeCandidates(
      [
        { ...base, id: 'a', name: 'A', price: 10, weight_kg: 2 },
        { ...base, id: 'b', name: 'B', price: 10 },
      ],
      1,
    )
    expect(res.candidates.every((c) => c.score === 100)).toBe(true)
  })

  it('ranks within each request item group and handles a single candidate', () => {
    const res = analyzeCandidates(
      [
        { ...base, id: 'a1', name: 'A1', request_item_id: 'i1', price: 5 },
        { ...base, id: 'a2', name: 'A2', request_item_id: 'i1', price: 9 },
        { ...base, id: 'b1', name: 'B1', request_item_id: 'i2', price: 100 },
      ],
      1,
    )
    expect(res.recommended_ids).toEqual(['a1'])
    expect(res.candidates.find((c) => c.id === 'b1')!.rank).toBe(1)
    expect(res.candidates.find((c) => c.id === 'b1')!.is_recommended).toBe(false)
  })

  it('uses package volume, falling back to product dimensions', () => {
    const res = analyzeCandidates(
      [
        { ...base, id: 'p', name: 'P', length_cm: 10, width_cm: 10, height_cm: 10 },
        { ...base, id: 'q', name: 'Q', pack_length_cm: 5, pack_width_cm: 5, pack_height_cm: 5 },
      ],
      1,
    )
    expect(res.candidates.find((c) => c.id === 'p')!.volume_cm3).toBe(1000)
    expect(res.candidates.find((c) => c.id === 'q')!.volume_cm3).toBe(125)
  })
})
