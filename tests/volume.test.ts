import { describe, expect, it } from 'vitest'
import { roundCbm, unitVolumeCbm } from '../utils/volume'

describe('unitVolumeCbm', () => {
  it('converts packed cm dimensions to cubic metres', () => {
    expect(unitVolumeCbm({ pack_length_cm: '50', pack_width_cm: '40', pack_height_cm: '30' })).toBeCloseTo(0.06, 6)
  })
  it('falls back to bare product dimensions when there is no packaging data', () => {
    expect(unitVolumeCbm({ length_cm: 10, width_cm: 10, height_cm: 10 })).toBeCloseTo(0.001, 6)
  })
  it('returns null when any dimension is missing or zero', () => {
    expect(unitVolumeCbm({ pack_length_cm: 10, pack_width_cm: 10, pack_height_cm: null })).toBeNull()
    expect(unitVolumeCbm({ pack_length_cm: 10, pack_width_cm: 0, pack_height_cm: 10 })).toBeNull()
    expect(unitVolumeCbm(null)).toBeNull()
  })
  it('rounds line volume without float noise', () => {
    expect(roundCbm(0.1 * 3)).toBe(0.3)
  })
})
