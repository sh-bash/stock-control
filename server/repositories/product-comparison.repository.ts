import { asc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { productComparisons, comparisonCandidates } from '../db/schema'
import { listPaged, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = {
  no_comparison: productComparisons.no_comparison,
  title: productComparisons.title,
  status: productComparisons.status,
  created_at: productComparisons.created_at,
}

export function listComparisons() {
  return db.select().from(productComparisons)
}

export function listComparisonsPaged(
  opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & {
    sortBy?: string
    status?: string | string[]
    requestId?: string
  },
) {
  const extraFilters = []
  if (opts.status) extraFilters.push({ column: productComparisons.status, value: opts.status })
  if (opts.requestId) extraFilters.push({ column: productComparisons.request_id, value: opts.requestId })
  return listPaged(productComparisons, {
    ...opts,
    searchColumns: [productComparisons.no_comparison, productComparisons.title],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || productComparisons.created_at,
    sortDir: opts.sortDir ?? 'desc',
    extraFilters,
    dateColumn: productComparisons.created_at,
  })
}

export function findComparison(id: string) {
  return db.query.productComparisons.findFirst({ where: eq(productComparisons.id, id) })
}

export function createComparison(values: typeof productComparisons.$inferInsert) {
  return db.insert(productComparisons).values(values).returning()
}

export function updateComparison(id: string, values: Record<string, unknown>) {
  return db
    .update(productComparisons)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(productComparisons.id, id))
    .returning()
}

export function deleteComparison(id: string) {
  return db.delete(productComparisons).where(eq(productComparisons.id, id)).returning()
}

export function listCandidates(comparisonId: string) {
  return db
    .select()
    .from(comparisonCandidates)
    .where(eq(comparisonCandidates.comparison_id, comparisonId))
    .orderBy(asc(comparisonCandidates.created_at))
}

export function findCandidate(id: string) {
  return db.query.comparisonCandidates.findFirst({ where: eq(comparisonCandidates.id, id) })
}

export function createCandidate(values: typeof comparisonCandidates.$inferInsert) {
  return db.insert(comparisonCandidates).values(values).returning()
}

export function updateCandidate(id: string, values: Record<string, unknown>) {
  return db
    .update(comparisonCandidates)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(comparisonCandidates.id, id))
    .returning()
}

export function deleteCandidate(id: string) {
  return db.delete(comparisonCandidates).where(eq(comparisonCandidates.id, id)).returning()
}
