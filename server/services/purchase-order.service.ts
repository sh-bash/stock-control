import { db } from '../db/client'
import {
  createOrder,
  createItem,
  deleteItemsOfOrder,
  deleteOrder,
  findOrder,
  listItems,
  updateOrder,
  updateOrderTx,
} from '../repositories/purchase-order.repository'
import { findInstanceByDocument } from '../repositories/approval-instance.repository'
import { findRequest } from '../repositories/product-request.repository'
import { findComparison, updateComparison } from '../repositories/product-comparison.repository'
import { createApprovalInstance, approveInstance, rejectInstance } from './approval.service'
import { setRequestStatus } from './product-request.service'
import { failure } from '../utils/response'
import { genDocNo } from '../utils/doc-no'

export interface PoItemInput {
  product_id: string
  candidate_id?: string | null
  qty_order: number
  // Price in the PO's own currency.
  price: number
}

export interface PoInput {
  supplier_id: string
  warehouse_id: string
  order_date: string
  currency: 'RMB' | 'IDR'
  exchange_rate: number
  request_id?: string | null
  comparison_id?: string | null
  notes?: string | null
  items: PoItemInput[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

// The PO's currency/rate decide how each line's IDR unit_price is derived.
// IDR stays IDR (rate forced to 1, no foreign price); RMB multiplies by the
// rate typed on the PO. unit_price is ALWAYS IDR so everything downstream
// (shipment allocation, receiving HPP, reports) is currency-agnostic.
export function computePoLines(currency: 'RMB' | 'IDR', exchangeRate: number, items: PoItemInput[]) {
  const rate = currency === 'IDR' ? 1 : exchangeRate
  const lines = items.map((it) => ({
    product_id: it.product_id,
    candidate_id: it.candidate_id ?? null,
    qty_order: it.qty_order,
    price_foreign: currency === 'IDR' ? null : round2(it.price),
    unit_price: round2(it.price * rate),
  }))
  const total_foreign = currency === 'IDR' ? null : round2(items.reduce((s, it) => s + it.qty_order * it.price, 0))
  const total_idr = round2(lines.reduce((s, l) => s + l.qty_order * l.unit_price, 0))
  return { rate, lines, total_foreign, total_idr }
}

async function insertPoLines(poId: string, input: PoInput) {
  const { lines } = computePoLines(input.currency, input.exchange_rate, input.items)
  const items = []
  for (const l of lines) {
    const [row] = await createItem({
      po_id: poId,
      product_id: l.product_id,
      candidate_id: l.candidate_id,
      qty_order: l.qty_order.toString(),
      price_foreign: l.price_foreign?.toString() ?? null,
      unit_price: l.unit_price.toString(),
    })
    items.push(row)
  }
  return items
}

async function validatePoSource(input: PoInput) {
  if (input.items.length === 0) return failure('PO harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  if (input.currency === 'RMB' && !(input.exchange_rate > 0)) {
    return failure('Kurs wajib diisi untuk PO dalam RMB', 'MISSING_EXCHANGE_RATE', 400)
  }
  if (input.request_id) {
    const req = await findRequest(input.request_id)
    if (!req) return failure('Product request tidak ditemukan', 'NOT_FOUND', 404)
    if (!['approved', 'comparing', 'ordered'].includes(req.status)) {
      return failure('PO hanya bisa dibuat dari product request yang sudah approved', 'REQUEST_NOT_APPROVED', 400)
    }
  }
  if (input.comparison_id) {
    const cmp = await findComparison(input.comparison_id)
    if (!cmp) return failure('Product comparison tidak ditemukan', 'NOT_FOUND', 404)
    if (input.request_id && cmp.request_id !== input.request_id) {
      return failure('Comparison bukan milik product request yang dipilih', 'REQUEST_MISMATCH', 400)
    }
  }
}

// Once a PO exists for a request/comparison, move their lifecycle forward.
async function advanceSources(input: PoInput) {
  const requestId = input.request_id ?? (input.comparison_id ? (await findComparison(input.comparison_id))?.request_id : null)
  if (requestId) {
    const req = await findRequest(requestId)
    if (req && ['approved', 'comparing'].includes(req.status)) await setRequestStatus(requestId, 'ordered')
  }
  if (input.comparison_id) await updateComparison(input.comparison_id, { status: 'decided' })
}

export async function createPurchaseOrder(input: PoInput & { created_by: string }) {
  await validatePoSource(input)

  const [po] = await createOrder({
    no_po: genDocNo('PO'),
    supplier_id: input.supplier_id,
    warehouse_id: input.warehouse_id,
    order_date: input.order_date,
    currency: input.currency,
    exchange_rate: (input.currency === 'IDR' ? 1 : input.exchange_rate).toString(),
    request_id: input.request_id ?? null,
    comparison_id: input.comparison_id ?? null,
    notes: input.notes ?? null,
    created_by: input.created_by,
    status: 'draft',
  })

  await insertPoLines(po.id, input)
  await advanceSources(input)
  return getPurchaseOrderWithItems(po.id)
}

// Draft / rejected POs can be edited in place — header fields and the whole
// item list are replaced (nothing references PO items until it is approved).
export async function updatePurchaseOrder(id: string, input: PoInput) {
  const po = await findOrder(id)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)
  if (!['draft', 'rejected'].includes(po.status)) {
    return failure(`PO berstatus "${po.status}" tidak bisa diubah`, 'INVALID_STATUS', 400)
  }
  await validatePoSource(input)

  await updateOrder(id, {
    supplier_id: input.supplier_id,
    warehouse_id: input.warehouse_id,
    order_date: input.order_date,
    currency: input.currency,
    exchange_rate: (input.currency === 'IDR' ? 1 : input.exchange_rate).toString(),
    request_id: input.request_id ?? null,
    comparison_id: input.comparison_id ?? null,
    notes: input.notes ?? null,
    status: 'draft',
  })
  await deleteItemsOfOrder(id)
  await insertPoLines(id, input)
  await advanceSources(input)
  return getPurchaseOrderWithItems(id)
}

export async function deletePurchaseOrder(id: string) {
  const po = await findOrder(id)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)
  if (po.status !== 'draft') return failure('Hanya PO draft yang bisa dihapus', 'INVALID_STATUS', 400)
  await deleteItemsOfOrder(id)
  await deleteOrder(id)
  return { id }
}

export async function getPurchaseOrderWithItems(id: string) {
  const po = await findOrder(id)
  if (!po) return null
  const items = await listItems(id)
  const total_idr = round2(items.reduce((s, i) => s + Number(i.qty_order) * Number(i.unit_price), 0))
  const total_foreign =
    po.currency === 'IDR' ? null : round2(items.reduce((s, i) => s + Number(i.qty_order) * Number(i.price_foreign ?? 0), 0))
  return { ...po, items, total_idr, total_foreign }
}

export async function submitPurchaseOrder(poId: string) {
  const po = await findOrder(poId)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)
  if (!['draft', 'rejected'].includes(po.status)) {
    return failure(`PO tidak bisa disubmit dari status "${po.status}"`, 'INVALID_STATUS', 400)
  }

  const instance = await createApprovalInstance('po', poId)
  const rows = await updateOrder(poId, { status: 'waiting_approval' })
  return { po: rows[0], approval_instance: instance }
}

// The approval-instance status flip and the PO's own status flip are done
// inside ONE transaction. Without this, approveInstance() could commit the
// instance as 'approved' on its own, then a later failure updating the PO
// would leave the instance permanently 'approved' (un-retryable) while the
// PO stays stuck in 'waiting_approval' forever.
export async function approvePurchaseOrder(poId: string, approverId: string, note?: string) {
  const po = await findOrder(poId)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('po', poId)
  if (!instance) return failure('Approval instance untuk PO ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  return db.transaction(async (tx) => {
    const updatedInstance = await approveInstance(instance.id, approverId, note, tx)

    if (updatedInstance.status === 'approved') {
      const rows = await updateOrderTx(tx, poId, { status: 'approved' })
      return rows[0]
    }

    return po
  })
}

export async function rejectPurchaseOrder(poId: string, approverId: string, note?: string) {
  const po = await findOrder(poId)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('po', poId)
  if (!instance) return failure('Approval instance untuk PO ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  return db.transaction(async (tx) => {
    await rejectInstance(instance.id, approverId, note, tx)
    const rows = await updateOrderTx(tx, poId, { status: 'rejected' })
    return rows[0]
  })
}

export async function recalculatePurchaseOrderStatus(poId: string) {
  const po = await findOrder(poId)
  if (!po) return
  if (po.status !== 'approved' && po.status !== 'partial_received') return

  const items = await listItems(poId)
  const totalOrdered = items.reduce((sum, i) => sum + Number(i.qty_order), 0)
  const totalReceived = items.reduce((sum, i) => sum + Number(i.qty_received), 0)

  let newStatus = po.status
  if (totalReceived >= totalOrdered && totalOrdered > 0) {
    newStatus = 'closed'
  } else if (totalReceived > 0) {
    newStatus = 'partial_received'
  }

  if (newStatus !== po.status) {
    await updateOrder(poId, { status: newStatus })
  }
}
