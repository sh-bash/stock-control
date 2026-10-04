import { describe, expect, it } from 'vitest'
import { formatQty, formatCurrency, formatInt, formatNumber } from '../utils/format'

describe('format helpers (id-ID)', () => {
  it('formats with 2 decimals and thousands separator', () => {
    expect(formatNumber(15000)).toBe('15.000,00')
    expect(formatNumber('10.0000')).toBe('10,00')
    expect(formatNumber(1234567.891)).toBe('1.234.567,89')
  })
  it('returns dash for blank values', () => {
    expect(formatNumber(null)).toBe('-')
    expect(formatNumber('')).toBe('-')
    expect(formatNumber(undefined)).toBe('-')
    expect(formatNumber('abc')).toBe('-')
  })
  it('formats qty without forced decimals', () => {
    expect(formatQty(33)).toBe('33')
    expect(formatQty('10.0000')).toBe('10')
    expect(formatQty(1234.5)).toBe('1.234,5')
    expect(formatQty(null)).toBe('-')
  })
  it('formats ints and currency', () => {
    expect(formatInt(12345)).toBe('12.345')
    expect(formatCurrency(2500)).toBe('Rp 2.500,00')
  })
})
