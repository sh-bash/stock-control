import { eq, type AnyColumn } from 'drizzle-orm'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import { db } from '../db/client'

export function listAll(table: PgTableWithColumns<any>) {
  return db.select().from(table as any)
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
