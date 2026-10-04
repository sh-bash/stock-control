// Pure scoring for Product Comparison — no DB access so it can be unit tested.
//
// Each candidate is scored 0-100 across four "lower is better" metrics: IDR
// price, weight, packed volume and lead time. For a metric, a candidate's
// sub-score is (best value in its group) / (its value), so the cheapest /
// lightest / smallest / fastest one gets 1 and the rest scale down in
// proportion. A candidate missing a metric is simply left out of that metric,
// and the weights of the remaining metrics are re-normalised, so incomplete
// data neither wins nor loses by default.

export type Currency = 'RMB' | 'IDR'

export interface CandidateInput {
  id: string
  request_item_id: string | null
  name: string
  price: number
  currency: Currency
  lead_time_days: number | null
  weight_kg: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  pack_length_cm: number | null
  pack_width_cm: number | null
  pack_height_cm: number | null
}

export interface Weights {
  price: number
  weight: number
  volume: number
  lead_time: number
}

export const DEFAULT_WEIGHTS: Weights = { price: 0.5, weight: 0.2, volume: 0.15, lead_time: 0.15 }

export type MetricKey = keyof Weights

export interface CandidateAnalysis {
  id: string
  group: string
  price_idr: number
  volume_cm3: number | null
  metrics: Record<MetricKey, number | null>
  sub_scores: Record<MetricKey, number | null>
  score: number
  rank: number
  best_in: MetricKey[]
  is_recommended: boolean
}

export interface ComparisonAnalysis {
  candidates: CandidateAnalysis[]
  recommended_ids: string[]
  summary: string[]
}

const METRIC_LABEL: Record<MetricKey, string> = {
  price: 'harga',
  weight: 'berat',
  volume: 'volume kemasan',
  lead_time: 'lead time',
}

export function normalizeWeights(input?: Partial<Weights> | null): Weights {
  const merged: Weights = { ...DEFAULT_WEIGHTS }
  for (const k of Object.keys(DEFAULT_WEIGHTS) as MetricKey[]) {
    const v = input?.[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) merged[k] = v
  }
  return merged
}

export function toIdr(price: number, currency: Currency, rate: number) {
  return currency === 'RMB' ? price * rate : price
}

function volumeOf(c: CandidateInput): number | null {
  const pack = [c.pack_length_cm, c.pack_width_cm, c.pack_height_cm]
  if (pack.every((v) => v != null && v > 0)) return pack[0]! * pack[1]! * pack[2]!
  const prod = [c.length_cm, c.width_cm, c.height_cm]
  if (prod.every((v) => v != null && v > 0)) return prod[0]! * prod[1]! * prod[2]!
  return null
}

export function analyzeCandidates(
  candidates: CandidateInput[],
  rate: number,
  weightsInput?: Partial<Weights> | null,
): ComparisonAnalysis {
  const weights = normalizeWeights(weightsInput)
  const keys = Object.keys(weights) as MetricKey[]

  const rows = candidates.map((c) => {
    const price_idr = toIdr(c.price, c.currency, rate)
    const volume_cm3 = volumeOf(c)
    const metrics: Record<MetricKey, number | null> = {
      price: price_idr > 0 ? price_idr : null,
      weight: c.weight_kg != null && c.weight_kg > 0 ? c.weight_kg : null,
      volume: volume_cm3,
      lead_time: c.lead_time_days != null && c.lead_time_days > 0 ? c.lead_time_days : null,
    }
    return { c, price_idr, volume_cm3, metrics, group: c.request_item_id ?? 'all' }
  })

  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = groups.get(r.group) ?? []
    list.push(r)
    groups.set(r.group, list)
  }

  const out: CandidateAnalysis[] = []
  const recommended: string[] = []

  for (const [group, members] of groups) {
    const best: Record<MetricKey, number | null> = { price: null, weight: null, volume: null, lead_time: null }
    for (const k of keys) {
      const vals = members.map((m) => m.metrics[k]).filter((v): v is number => v != null)
      best[k] = vals.length > 0 ? Math.min(...vals) : null
    }

    const scored = members.map((m) => {
      const sub_scores: Record<MetricKey, number | null> = { price: null, weight: null, volume: null, lead_time: null }
      let weighted = 0
      let weightSum = 0
      for (const k of keys) {
        const v = m.metrics[k]
        const b = best[k]
        if (v == null || b == null) continue
        sub_scores[k] = b / v
        weighted += sub_scores[k]! * weights[k]
        weightSum += weights[k]
      }
      const score = weightSum > 0 ? Math.round((weighted / weightSum) * 1000) / 10 : 0
      const best_in = keys.filter((k) => m.metrics[k] != null && best[k] != null && m.metrics[k] === best[k] && members.length > 1)
      return { m, sub_scores, score, best_in }
    })

    scored.sort((a, b) => b.score - a.score)
    scored.forEach((s, i) => {
      const is_recommended = i === 0 && scored.length > 1 && s.score > 0
      if (is_recommended) recommended.push(s.m.c.id)
      out.push({
        id: s.m.c.id,
        group,
        price_idr: s.m.price_idr,
        volume_cm3: s.m.volume_cm3,
        metrics: s.m.metrics,
        sub_scores: s.sub_scores,
        score: s.score,
        rank: i + 1,
        best_in: s.best_in,
        is_recommended,
      })
    })
  }

  const nameOf = new Map(candidates.map((c) => [c.id, c.name]))
  const summary: string[] = []
  for (const id of recommended) {
    const a = out.find((x) => x.id === id)!
    const strengths = a.best_in.map((k) => METRIC_LABEL[k])
    summary.push(
      `${nameOf.get(id)} direkomendasikan (skor ${a.score})` +
        (strengths.length > 0 ? ` — terbaik di ${strengths.join(', ')}.` : '.'),
    )
  }
  if (candidates.length < 2) summary.push('Tambahkan minimal 2 kandidat untuk melihat analisa perbandingan.')

  return { candidates: out, recommended_ids: recommended, summary }
}
