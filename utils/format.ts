// Shared display formatters (id-ID: 1.234.567,89). Presentation only —
// values sent to / stored by the API are never touched.

const formatters = new Map<number, Intl.NumberFormat>()

const qtyFormatter = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 4 })

function getFormatter(digits: number): Intl.NumberFormat {
  let f = formatters.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    formatters.set(digits, f)
  }
  return f
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Fixed-decimal number with thousands separator; null/blank/NaN -> '-'. */
export function formatNumber(v: unknown, digits = 2): string {
  const n = toNumber(v)
  return n === null ? '-' : getFormatter(digits).format(n)
}

/** Quantities: thousands separator, up to 4 decimals, trailing zeros trimmed (33 -> "33", 1.5 -> "1,5"). */
export function formatQty(v: unknown): string {
  const n = toNumber(v)
  return n === null ? '-' : qtyFormatter.format(n)
}

/** Whole-number counts (product count, days, rows): thousands separator, no decimals. */
export function formatInt(v: unknown): string {
  return formatNumber(v, 0)
}

export function formatCurrency(v: unknown): string {
  const n = toNumber(v)
  return n === null ? '-' : `Rp ${getFormatter(2).format(n)}`
}
