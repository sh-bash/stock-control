import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { productComparisons, users } from '../db/schema'
import {
  createRequest,
  createRequestItem,
  deleteRequest,
  deleteRequestItems,
  findRequest,
  listRequestItems,
  updateRequest,
  updateRequestTx,
} from '../repositories/product-request.repository'
import { findInstanceByDocument } from '../repositories/approval-instance.repository'
import { createApprovalInstance, approveInstance, rejectInstance } from './approval.service'
import { failure } from '../utils/response'
import { genDocNo } from '../utils/doc-no'

export interface RequestItemInput {
  product_id?: string | null
  name: string
  spec?: string | null
  qty: number
  unit?: string | null
  notes?: string | null
}

export interface RequestInput {
  title: string
  notes?: string | null
  needed_date?: string | null
  needs_approval: boolean
  items: RequestItemInput[]
}

// Only these states can still be edited/deleted/re-submitted by the requester.
const EDITABLE = ['draft', 'rejected']

async function insertItems(requestId: string, items: RequestItemInput[]) {
  for (const it of items) {
    await createRequestItem({
      request_id: requestId,
      product_id: it.product_id ?? null,
      name: it.name,
      spec: it.spec ?? null,
      qty: it.qty.toString(),
      unit: it.unit ?? null,
      notes: it.notes ?? null,
    })
  }
}

export async function createProductRequest(input: RequestInput & { requested_by: string }) {
  if (input.items.length === 0) return failure('Request harus punya minimal 1 item', 'EMPTY_ITEMS', 400)

  const [req] = await createRequest({
    no_request: genDocNo('REQ'),
    title: input.title,
    notes: input.notes ?? null,
    needed_date: input.needed_date ?? null,
    needs_approval: input.needs_approval,
    status: 'draft',
    requested_by: input.requested_by,
  })
  await insertItems(req.id, input.items)
  return getRequestWithItems(req.id)
}

export async function getRequestWithItems(id: string) {
  const req = await findRequest(id)
  if (!req) return null
  const items = await listRequestItems(id)
  const [requester] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.requested_by))
  const comparisons = await db
    .select({ id: productComparisons.id, no_comparison: productComparisons.no_comparison, status: productComparisons.status })
    .from(productComparisons)
    .where(eq(productComparisons.request_id, id))
  return { ...req, requested_by_name: requester?.name ?? null, items, comparisons }
}

export async function updateProductRequest(id: string, input: RequestInput) {
  const req = await findRequest(id)
  if (!req) return failure('Request tidak ditemukan', 'NOT_FOUND', 404)
  if (!EDITABLE.includes(req.status)) {
    return failure(`Request berstatus "${req.status}" tidak bisa diubah`, 'INVALID_STATUS', 400)
  }
  if (input.items.length === 0) return failure('Request harus punya minimal 1 item', 'EMPTY_ITEMS', 400)

  await updateRequest(id, {
    title: input.title,
    notes: input.notes ?? null,
    needed_date: input.needed_date ?? null,
    needs_approval: input.needs_approval,
    status: 'draft',
  })
  await deleteRequestItems(id)
  await insertItems(id, input.items)
  return getRequestWithItems(id)
}

export async function deleteProductRequest(id: string) {
  const req = await findRequest(id)
  if (!req) return failure('Request tidak ditemukan', 'NOT_FOUND', 404)
  if (req.status !== 'draft') return failure('Hanya request draft yang bisa dihapus', 'INVALID_STATUS', 400)
  const comparisons = await db.select({ id: productComparisons.id }).from(productComparisons).where(eq(productComparisons.request_id, id)).limit(1)
  if (comparisons.length > 0) return failure('Request sudah punya Product Comparison', 'HAS_COMPARISON', 400)
  await deleteRequestItems(id)
  await deleteRequest(id)
  return { id }
}

// needs_approval=false skips the approval engine entirely: the request goes
// straight to 'approved' and can be used for a comparison / PO right away.
export async function submitProductRequest(id: string) {
  const req = await findRequest(id)
  if (!req) return failure('Request tidak ditemukan', 'NOT_FOUND', 404)
  if (!EDITABLE.includes(req.status)) {
    return failure(`Request tidak bisa disubmit dari status "${req.status}"`, 'INVALID_STATUS', 400)
  }

  if (!req.needs_approval) {
    const rows = await updateRequest(id, { status: 'approved' })
    return { request: rows[0], approval_instance: null }
  }

  const instance = await createApprovalInstance('product_request', id)
  const rows = await updateRequest(id, { status: 'waiting_approval' })
  return { request: rows[0], approval_instance: instance }
}

export async function approveProductRequest(id: string, approverId: string, note?: string) {
  const req = await findRequest(id)
  if (!req) return failure('Request tidak ditemukan', 'NOT_FOUND', 404)
  const instance = await findInstanceByDocument('product_request', id)
  if (!instance) return failure('Approval instance untuk request ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  return db.transaction(async (tx) => {
    const updated = await approveInstance(instance.id, approverId, note, tx)
    if (updated.status === 'approved') {
      const rows = await updateRequestTx(tx, id, { status: 'approved' })
      return rows[0]
    }
    return req
  })
}

export async function rejectProductRequest(id: string, approverId: string, note?: string) {
  const req = await findRequest(id)
  if (!req) return failure('Request tidak ditemukan', 'NOT_FOUND', 404)
  const instance = await findInstanceByDocument('product_request', id)
  if (!instance) return failure('Approval instance untuk request ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  return db.transaction(async (tx) => {
    await rejectInstance(instance.id, approverId, note, tx)
    const rows = await updateRequestTx(tx, id, { status: 'rejected' })
    return rows[0]
  })
}

// Used by comparison/PO services to move the request along its lifecycle.
export async function setRequestStatus(id: string, status: string) {
  await updateRequest(id, { status })
}
