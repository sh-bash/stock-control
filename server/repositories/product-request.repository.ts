import { eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { productRequests, productRequestItems } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

type Tx = PgTransaction<any, any, any>

const SORT_COLUMNS: Record<string, any> = {
  no_request: productRequests.no_request,
  title: productRequests.title,
  status: productRequests.status,
  created_at: productRequests.created_at,
  needed_date: productRequests.needed_date,
}

export function listRequests() {
  return db.select().from(productRequests)
}

export function listRequestsPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & {
    sortBy?: string
    status?: string | string[]
    requestedBy?: string
  },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: productRequests.status, value: opts.status })
  if (opts.requestedBy) extraFilters.push({ column: productRequests.requested_by, value: opts.requestedBy })
  return listPaged(productRequests, {
    ...opts,
    searchColumns: [productRequests.no_request, productRequests.title],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || productRequests.created_at,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    dateColumn: productRequests.created_at,
  })
}

export function findRequest(id: string) {
  return db.query.productRequests.findFirst({ where: eq(productRequests.id, id) })
}

export function createRequest(values: typeof productRequests.$inferInsert) {
  return db.insert(productRequests).values(values).returning()
}

export function updateRequest(id: string, values: Record<string, unknown>) {
  return db
    .update(productRequests)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(productRequests.id, id))
    .returning()
}

export function updateRequestTx(tx: Tx, id: string, values: Record<string, unknown>) {
  return tx
    .update(productRequests)
    .set({ ...values, updated_at: new Date() })
    .where(eq(productRequests.id, id))
    .returning()
}

export function deleteRequest(id: string) {
  return db.delete(productRequests).where(eq(productRequests.id, id)).returning()
}

export function listRequestItems(requestId: string) {
  return db.select().from(productRequestItems).where(eq(productRequestItems.request_id, requestId))
}

export function createRequestItem(values: typeof productRequestItems.$inferInsert) {
  return db.insert(productRequestItems).values(values).returning()
}

export function deleteRequestItems(requestId: string) {
  return db.delete(productRequestItems).where(eq(productRequestItems.request_id, requestId))
}
