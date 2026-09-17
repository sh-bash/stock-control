import { and, asc, desc, eq, ilike, or, sql, type AnyColumn } from 'drizzle-orm'
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
