import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import { db } from '../db/client'

export function listAll(table: PgTableWithColumns<any>) {
  return db.select().from(table as any)
}

export interface PagedListOptions {
  page: number
  pageSize: number
  search?: string
  searchColumns?: AnyColumn[]
  sortColumn?: AnyColumn
  sortDir?: 'asc' | 'desc'
  statusColumn?: AnyColumn
  statusValue?: string
  // Generic exact-match filters beyond the boolean is_active toggle above —
  // used by transactional lists (PO status, warehouse_id, etc). An array
  // value renders as an IN(...) clause (e.g. multi-select status filters).
  extraFilters?: { column: AnyColumn; value: string | string[] | boolean | undefined }[]
  // Date-range filter — dateFrom/dateTo arrive as bare "YYYY-MM-DD" strings
  // and are anchored to that day's start/end-of-day so a `timestamp` column
  // (e.g. stock_ledger.transaction_date) doesn't silently drop same-day
  // rows the way getStockCard's date_to once did (see report.repository.ts
  // for that bug/fix) — works equally correctly against a `date` column.
  dateColumn?: AnyColumn
  dateFrom?: string
  dateTo?: string
  // Escape hatch for a filter that can't be expressed as a plain column
  // comparison (e.g. Stock Summary's "kondisi stock" bucket, which needs a
  // correlated subquery against product_stock_settings) — ANDed in with
  // every other condition.
  rawCondition?: SQL | undefined
}

// Opt-in server-side pagination for the Master Data list endpoints (only
// used when the caller sends a `page` query param — see each
// `index.get.ts`). Kept separate from `listAll` rather than replacing it:
// several other pages (Purchase/Sale forms, Reports, Dashboard) fetch the
// *entire* master list to populate dropdown options, and must keep getting
// every row, not a truncated page of 20.
export async function listPaged(table: PgTableWithColumns<any>, options: PagedListOptions) {
  const conditions = []
  if (options.search && options.searchColumns?.length) {
    conditions.push(or(...options.searchColumns.map((col) => ilike(col, `%${options.search}%`))))
  }
  if (options.statusColumn && options.statusValue) {
    conditions.push(eq(options.statusColumn, options.statusValue === 'true'))
  }
  for (const f of options.extraFilters ?? []) {
    if (f.value === undefined || f.value === '') continue
    if (Array.isArray(f.value)) {
      if (f.value.length > 0) conditions.push(inArray(f.column, f.value))
    } else {
      conditions.push(eq(f.column, f.value))
    }
  }
  if (options.dateColumn && options.dateFrom) {
    conditions.push(gte(options.dateColumn, new Date(`${options.dateFrom}T00:00:00.000Z`) as any))
  }
  if (options.dateColumn && options.dateTo) {
    conditions.push(lte(options.dateColumn, new Date(`${options.dateTo}T23:59:59.999Z`) as any))
  }
  if (options.rawCondition) conditions.push(options.rawCondition)
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  let rowsQuery = db.select().from(table as any) as any
  let countQuery = db.select({ count: sql<string>`COUNT(*)` }).from(table as any) as any
  if (whereClause) {
    rowsQuery = rowsQuery.where(whereClause)
    countQuery = countQuery.where(whereClause)
  }
  if (options.sortColumn) {
    rowsQuery = rowsQuery.orderBy(options.sortDir === 'desc' ? desc(options.sortColumn) : asc(options.sortColumn))
  }
  rowsQuery = rowsQuery.limit(options.pageSize).offset((options.page - 1) * options.pageSize)

  const [rows, [{ count }]] = await Promise.all([rowsQuery, countQuery])
  return { rows, totalRows: Number(count) }
}

// Parses the opt-in pagination query params shared by every Master Data
// list endpoint. Returns null when the caller sends no `page` param at
// all — signaling "this is a dropdown-options fetch, return everything"
// (see listPaged's doc comment) — so existing callers that never pass
// `page` (Purchase/Sale forms, Reports, Dashboard) keep getting the full
// unpaginated array with zero behavior change.
export function parsePagingQuery(event: any) {
  const q = getQuery(event)
  if (typeof q.page !== 'string') return null
  return {
    page: Math.max(1, Number(q.page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.pageSize) || 20)),
    search: typeof q.search === 'string' && q.search.length > 0 ? q.search : undefined,
    sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
    sortDir: q.sortDir === 'desc' ? ('desc' as const) : ('asc' as const),
    statusValue: typeof q.is_active === 'string' ? q.is_active : undefined,
  }
}

// Same opt-in contract as parsePagingQuery, but without the is_active-
// specific field — for transactional lists (PO/Shipment/Receiving/etc)
// whose own endpoint reads its own extra filters (status, warehouse_id)
// directly and passes them to listPaged as `extraFilters`.
export function parseBasicPagingQuery(event: any) {
  const q = getQuery(event)
  if (typeof q.page !== 'string') return null
  return {
    page: Math.max(1, Number(q.page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.pageSize) || 20)),
    search: typeof q.search === 'string' && q.search.length > 0 ? q.search : undefined,
    sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
    sortDir: q.sortDir === 'desc' ? ('desc' as const) : ('asc' as const),
    dateFrom: typeof q.date_from === 'string' && q.date_from.length > 0 ? q.date_from : undefined,
    dateTo: typeof q.date_to === 'string' && q.date_to.length > 0 ? q.date_to : undefined,
  }
}

// Multi-select filters are sent by the frontend as one comma-joined query
// param (e.g. ?status=draft,approved) rather than repeated keys, since that
// survives ofetch's query serialization and router.replace({query}) equally
// well. Splits back into a string[] for `extraFilters`, or undefined if the
// param wasn't sent at all.
export function parseCsvQueryParam(event: any, key: string): string[] | undefined {
  const q = getQuery(event)
  const raw = q[key]
  const str = Array.isArray(raw) ? raw.join(',') : raw
  if (typeof str !== 'string' || str.length === 0) return undefined
  return str.split(',').filter(Boolean)
}

export function getById(table: PgTableWithColumns<any>, idColumn: AnyColumn, id: string) {
  return db.select().from(table as any).where(eq(idColumn, id)).limit(1)
}

export function insertOne(table: PgTableWithColumns<any>, values: Record<string, unknown>) {
  return db.insert(table as any).values(values as any).returning()
}

export function updateById(
  table: PgTableWithColumns<any>,
  idColumn: AnyColumn,
  id: string,
  values: Record<string, unknown>,
) {
  return db
    .update(table as any)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(idColumn, id))
    .returning()
}

export function deleteById(table: PgTableWithColumns<any>, idColumn: AnyColumn, id: string) {
  return db.delete(table as any).where(eq(idColumn, id)).returning()
}
