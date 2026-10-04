import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { products, suppliers, productRequestItems, attachments, purchaseOrders } from '../db/schema'
import {
  createCandidate,
  createComparison,
  deleteCandidate,
  deleteComparison,
  findCandidate,
  findComparison,
  listCandidates,
  updateCandidate,
  updateComparison,
} from '../repositories/product-comparison.repository'
import { findRequest, listRequestItems } from '../repositories/product-request.repository'
import { setRequestStatus } from './product-request.service'
import { analyzeCandidates, type CandidateInput, type Currency } from './comparison-analysis.service'
import { copyAttachments, deleteAttachmentsOf } from './attachment.service'
import { failure } from '../utils/response'
import { genDocNo } from '../utils/doc-no'
import { candidateSchema } from '../utils/schemas'

type CandidatePayload = z.infer<typeof candidateSchema>

const num = (v: string | number | null | undefined) => (v == null ? null : Number(v))

// Decimal columns arrive as strings; the numeric payload goes back as strings.
const str = (v: number | null | undefined) => (v == null ? null : v.toString())

function candidateValues(p: Partial<CandidatePayload>) {
  const v: Record<string, unknown> = {}
  if (p.request_item_id !== undefined) v.request_item_id = p.request_item_id
  if (p.supplier_id !== undefined) v.supplier_id = p.supplier_id
  if (p.name !== undefined) v.name = p.name
  if (p.price !== undefined) v.price = p.price.toString()
  if (p.currency !== undefined) v.currency = p.currency
  if (p.lead_time_days !== undefined) v.lead_time_days = p.lead_time_days
  if (p.notes !== undefined) v.notes = p.notes
  for (const k of [
    'moq',
    'weight_kg',
    'length_cm',
    'width_cm',
    'height_cm',
    'pack_length_cm',
    'pack_width_cm',
    'pack_height_cm',
  ] as const) {
    if (p[k] !== undefined) v[k] = str(p[k])
  }
  return v
}

export async function createProductComparison(input: {
  request_id: string
  title: string
  notes?: string | null
  exchange_rate: number
  weights?: Record<string, number | undefined> | null
  created_by: string
}) {
  const req = await findRequest(input.request_id)
  if (!req) return failure('Request tidak ditemukan', 'NOT_FOUND', 404)
  if (!['approved', 'comparing'].includes(req.status)) {
    return failure('Comparison hanya bisa dibuat dari request yang sudah approved', 'REQUEST_NOT_APPROVED', 400)
  }

  const [cmp] = await createComparison({
    no_comparison: genDocNo('CMP'),
    request_id: input.request_id,
    title: input.title,
    notes: input.notes ?? null,
    exchange_rate: input.exchange_rate.toString(),
    weights: input.weights ?? null,
    status: 'draft',
    created_by: input.created_by,
  })
  if (req.status === 'approved') await setRequestStatus(req.id, 'comparing')
  return getComparisonDetail(cmp.id)
}

// Full comparison view: candidates (with supplier name + photo ids) and the
// computed analysis — everything the compare page needs in one call.
export async function getComparisonDetail(id: string) {
  const cmp = await findComparison(id)
  if (!cmp) return null

  const [request, requestItems, candidates] = await Promise.all([
    findRequest(cmp.request_id),
    listRequestItems(cmp.request_id),
    listCandidates(id),
  ])

  const supplierIds = [...new Set(candidates.map((c) => c.supplier_id).filter((x): x is string => !!x))]
  const supplierRows = supplierIds.length
    ? await db.select({ id: suppliers.id, name: suppliers.name, lead: suppliers.default_lead_time_days }).from(suppliers).where(inArray(suppliers.id, supplierIds))
    : []
  const supplierMap = new Map(supplierRows.map((s) => [s.id, s]))

  const photoRows = candidates.length
    ? await db
        .select({ id: attachments.id, owner_id: attachments.owner_id })
        .from(attachments)
        .where(inArray(attachments.owner_id, candidates.map((c) => c.id)))
    : []
  const photosOf = new Map<string, string[]>()
  for (const p of photoRows) photosOf.set(p.owner_id, [...(photosOf.get(p.owner_id) ?? []), p.id])

  const rate = Number(cmp.exchange_rate)
  const inputs: CandidateInput[] = candidates.map((c) => ({
    id: c.id,
    request_item_id: c.request_item_id,
    name: c.name,
    price: Number(c.price),
    currency: c.currency as Currency,
    // Fall back to the supplier's default lead time when the candidate has none.
    lead_time_days: c.lead_time_days ?? (c.supplier_id ? supplierMap.get(c.supplier_id)?.lead || null : null),
    weight_kg: num(c.weight_kg),
    length_cm: num(c.length_cm),
    width_cm: num(c.width_cm),
    height_cm: num(c.height_cm),
    pack_length_cm: num(c.pack_length_cm),
    pack_width_cm: num(c.pack_width_cm),
    pack_height_cm: num(c.pack_height_cm),
  }))
  const analysis = analyzeCandidates(inputs, rate, cmp.weights as any)

  return {
    ...cmp,
    request: request ? { id: request.id, no_request: request.no_request, title: request.title, status: request.status } : null,
    request_items: requestItems,
    candidates: candidates.map((c) => ({
      ...c,
      supplier_name: c.supplier_id ? supplierMap.get(c.supplier_id)?.name ?? null : null,
      photo_ids: photosOf.get(c.id) ?? [],
    })),
    analysis,
  }
}

export async function updateProductComparison(id: string, patch: Record<string, unknown>) {
  const cmp = await findComparison(id)
  if (!cmp) return failure('Comparison tidak ditemukan', 'NOT_FOUND', 404)
  const values: Record<string, unknown> = {}
  if (patch.title !== undefined) values.title = patch.title
  if (patch.notes !== undefined) values.notes = patch.notes
  if (patch.exchange_rate !== undefined) values.exchange_rate = String(patch.exchange_rate)
  if (patch.weights !== undefined) values.weights = patch.weights
  if (patch.status !== undefined) values.status = patch.status
  await updateComparison(id, values)
  return getComparisonDetail(id)
}

async function assertNotLocked(comparisonId: string) {
  const cmp = await findComparison(comparisonId)
  if (!cmp) return failure('Comparison tidak ditemukan', 'NOT_FOUND', 404)
  if (cmp.status === 'closed') return failure('Comparison sudah closed dan tidak bisa diubah', 'COMPARISON_CLOSED', 400)
  return cmp
}

export async function deleteProductComparison(id: string) {
  const cmp = await findComparison(id)
  if (!cmp) return failure('Comparison tidak ditemukan', 'NOT_FOUND', 404)
  if (cmp.status !== 'draft') return failure('Hanya comparison draft yang bisa dihapus', 'INVALID_STATUS', 400)
  const used = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.comparison_id, id)).limit(1)
  if (used.length > 0) return failure('Comparison sudah dipakai oleh Purchase Order', 'IN_USE', 400)
  for (const c of await listCandidates(id)) {
    await deleteAttachmentsOf('candidate', c.id)
    await deleteCandidate(c.id)
  }
  await deleteComparison(id)
  return { id }
}

export async function addCandidate(comparisonId: string, payload: CandidatePayload) {
  await assertNotLocked(comparisonId)
  const [row] = await createCandidate({
    comparison_id: comparisonId,
    name: payload.name,
    price: payload.price.toString(),
    currency: payload.currency,
    ...candidateValues(payload),
  } as any)
  return row
}

export async function editCandidate(candidateId: string, payload: Partial<CandidatePayload>) {
  const existing = await findCandidate(candidateId)
  if (!existing) return failure('Kandidat tidak ditemukan', 'NOT_FOUND', 404)
  await assertNotLocked(existing.comparison_id)
  const [row] = await updateCandidate(candidateId, candidateValues(payload))
  return row
}

export async function removeCandidate(candidateId: string) {
  const existing = await findCandidate(candidateId)
  if (!existing) return failure('Kandidat tidak ditemukan', 'NOT_FOUND', 404)
  await assertNotLocked(existing.comparison_id)
  if (existing.promoted_product_id) {
    return failure('Kandidat sudah dijadikan master product dan tidak bisa dihapus', 'ALREADY_PROMOTED', 400)
  }
  await deleteAttachmentsOf('candidate', candidateId)
  await deleteCandidate(candidateId)
  return { id: candidateId }
}

export async function setCandidateSelected(candidateId: string, selected: boolean) {
  const existing = await findCandidate(candidateId)
  if (!existing) return failure('Kandidat tidak ditemukan', 'NOT_FOUND', 404)
  await assertNotLocked(existing.comparison_id)
  const [row] = await updateCandidate(candidateId, { is_selected: selected })
  return row
}

function autoSku() {
  return `P-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

// Pushes SELECTED candidates into the product master. A candidate whose request
// item already points at an existing product is linked to it instead of
// creating a duplicate. Idempotent: an already-promoted candidate is skipped.
export async function promoteCandidates(
  comparisonId: string,
  items: { candidate_id: string; sku?: string; name?: string; category_id?: string | null; base_unit_id?: string | null }[],
) {
  await assertNotLocked(comparisonId)
  const candidates = await listCandidates(comparisonId)
  const byId = new Map(candidates.map((c) => [c.id, c]))

  const results: { candidate_id: string; product_id: string; created: boolean }[] = []

  for (const it of items) {
    const cand = byId.get(it.candidate_id)
    if (!cand) return failure('Kandidat bukan bagian dari comparison ini', 'CANDIDATE_MISMATCH', 400)
    if (!cand.is_selected) return failure(`Kandidat "${cand.name}" belum dipilih`, 'NOT_SELECTED', 400)
    if (cand.promoted_product_id) {
      results.push({ candidate_id: cand.id, product_id: cand.promoted_product_id, created: false })
      continue
    }

    let productId: string | null = null
    if (cand.request_item_id) {
      const [ri] = await db.select().from(productRequestItems).where(eq(productRequestItems.id, cand.request_item_id))
      productId = ri?.product_id ?? null
    }

    let created = false
    if (!productId) {
      const [prod] = await db
        .insert(products)
        .values({
          sku: it.sku ?? autoSku(),
          name: it.name ?? cand.name,
          category_id: it.category_id ?? null,
          base_unit_id: it.base_unit_id ?? null,
          weight_kg: cand.weight_kg,
          length_cm: cand.length_cm,
          width_cm: cand.width_cm,
          height_cm: cand.height_cm,
          pack_length_cm: cand.pack_length_cm,
          pack_width_cm: cand.pack_width_cm,
          pack_height_cm: cand.pack_height_cm,
          notes: cand.notes,
        })
        .returning()
        .catch((err: any) => {
          if (err?.code === '23505') return failure(`SKU "${it.sku}" sudah dipakai produk lain`, 'DUPLICATE_SKU', 409)
          throw err
        })
      productId = prod.id
      created = true
      await copyAttachments('candidate', cand.id, 'product', prod.id)
    }

    await updateCandidate(cand.id, { promoted_product_id: productId })
    results.push({ candidate_id: cand.id, product_id: productId, created })
  }

  return results
}

// Prefill for "Buat PO dari Comparison": selected + promoted candidates,
// grouped by supplier (a PO has exactly one supplier).
export async function getPoDraft(comparisonId: string) {
  const cmp = await findComparison(comparisonId)
  if (!cmp) return failure('Comparison tidak ditemukan', 'NOT_FOUND', 404)
  const selected = (await listCandidates(comparisonId)).filter((c) => c.is_selected)
  if (selected.length === 0) return failure('Belum ada kandidat yang dipilih', 'NO_SELECTION', 400)
  const unpromoted = selected.filter((c) => !c.promoted_product_id)
  if (unpromoted.length > 0) {
    return failure(
      `Jadikan master product dulu: ${unpromoted.map((c) => c.name).join(', ')}`,
      'NOT_PROMOTED',
      400,
    )
  }

  const reqItems = await listRequestItems(cmp.request_id)
  const qtyOf = new Map(reqItems.map((r) => [r.id, Number(r.qty)]))

  const groups = new Map<string, { supplier_id: string | null; currency: string; items: any[] }>()
  for (const c of selected) {
    const key = `${c.supplier_id ?? 'none'}:${c.currency}`
    const g = groups.get(key) ?? { supplier_id: c.supplier_id, currency: c.currency, items: [] }
    g.items.push({
      product_id: c.promoted_product_id,
      candidate_id: c.id,
      name: c.name,
      qty_order: (c.request_item_id && qtyOf.get(c.request_item_id)) || Number(c.moq ?? 1) || 1,
      price: Number(c.price),
    })
    groups.set(key, g)
  }

  return {
    comparison_id: cmp.id,
    request_id: cmp.request_id,
    exchange_rate: Number(cmp.exchange_rate),
    groups: [...groups.values()],
  }
}
