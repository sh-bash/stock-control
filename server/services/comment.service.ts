import { and, asc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../db/client'
import {
  documentComments,
  users,
  productRequests,
  purchaseOrders,
  receivings,
  shipmentPoRef,
} from '../db/schema'
import { failure } from '../utils/response'

export const COMMENT_REF_TYPES = ['request', 'po', 'receiving'] as const
export type CommentRefType = (typeof COMMENT_REF_TYPES)[number]

export function listComments(refType: string, refId: string) {
  return db
    .select({
      id: documentComments.id,
      ref_type: documentComments.ref_type,
      ref_id: documentComments.ref_id,
      user_id: documentComments.user_id,
      user_name: users.name,
      message: documentComments.message,
      is_issue: documentComments.is_issue,
      created_at: documentComments.created_at,
    })
    .from(documentComments)
    .innerJoin(users, eq(documentComments.user_id, users.id))
    .where(and(eq(documentComments.ref_type, refType), eq(documentComments.ref_id, refId)))
    .orderBy(asc(documentComments.created_at))
}

export async function addComment(input: {
  ref_type: CommentRefType
  ref_id: string
  user_id: string
  message: string
  is_issue: boolean
}) {
  const [row] = await db.insert(documentComments).values(input).returning()
  return row
}

export async function setCommentIssue(id: string, userId: string, isIssue: boolean) {
  const existing = await db.query.documentComments.findFirst({ where: eq(documentComments.id, id) })
  if (!existing) return failure('Komentar tidak ditemukan', 'NOT_FOUND', 404)
  if (existing.user_id !== userId) return failure('Hanya penulis komentar yang bisa mengubahnya', 'FORBIDDEN', 403)
  const [row] = await db
    .update(documentComments)
    .set({ is_issue: isIssue, updated_at: new Date() })
    .where(eq(documentComments.id, id))
    .returning()
  return row
}

// Purchase Return warning banner: every comment flagged as an issue on the
// receiving being returned, on the POs it fulfilled, and on the product
// requests those POs came from — i.e. what everyone involved already reported.
export async function getReturnWarnings(receivingId: string) {
  const receiving = await db.query.receivings.findFirst({ where: eq(receivings.id, receivingId) })
  if (!receiving) return failure('Receiving tidak ditemukan', 'NOT_FOUND', 404)

  const poRows = await db
    .selectDistinct({ id: purchaseOrders.id, no_po: purchaseOrders.no_po, request_id: purchaseOrders.request_id })
    .from(shipmentPoRef)
    .innerJoin(purchaseOrders, eq(shipmentPoRef.po_id, purchaseOrders.id))
    .where(eq(shipmentPoRef.shipment_id, receiving.shipment_id))

  const poIds = poRows.map((p) => p.id)
  const requestIds = [...new Set(poRows.map((p) => p.request_id).filter((x): x is string => !!x))]
  const requestRows = requestIds.length
    ? await db.select({ id: productRequests.id, no: productRequests.no_request }).from(productRequests).where(inArray(productRequests.id, requestIds))
    : []

  const refs = [
    { type: 'receiving', id: receiving.id, label: receiving.no_receiving },
    ...poRows.map((p) => ({ type: 'po', id: p.id, label: p.no_po })),
    ...requestRows.map((r) => ({ type: 'request', id: r.id, label: r.no })),
  ]
  const labelOf = new Map(refs.map((r) => [`${r.type}:${r.id}`, r.label]))

  const conditions = refs.map((r) => and(eq(documentComments.ref_type, r.type), eq(documentComments.ref_id, r.id)))
  const rows = await db
    .select({
      id: documentComments.id,
      ref_type: documentComments.ref_type,
      ref_id: documentComments.ref_id,
      user_name: users.name,
      message: documentComments.message,
      created_at: documentComments.created_at,
    })
    .from(documentComments)
    .innerJoin(users, eq(documentComments.user_id, users.id))
    .where(and(eq(documentComments.is_issue, true), or(...conditions)))
    .orderBy(asc(documentComments.created_at))

  return {
    receiving_id: receivingId,
    issues: rows.map((r) => ({ ...r, ref_label: labelOf.get(`${r.ref_type}:${r.ref_id}`) ?? null })),
  }
}
