import { globalStockSettings } from '../db/schema'
import { db } from '../db/client'
import { eq } from 'drizzle-orm'

export async function getSettings() {
  const rows = await db.select().from(globalStockSettings).limit(1)
  return rows[0] ?? null
}

export async function upsertSettings(values: Record<string, unknown>) {
  const existing = await getSettings()
  if (existing) {
    const rows = await db
      .update(globalStockSettings)
      .set({ ...values, updated_at: new Date() } as any)
      .where(eq(globalStockSettings.id, existing.id))
      .returning()
    return rows[0]
  }
  const rows = await db.insert(globalStockSettings).values(values as any).returning()
  return rows[0]
}
