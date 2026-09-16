import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { approvalInstances, approvalInstanceLogs } from '../db/schema'

export function createInstance(values: {
  workflow_id: string
  document_type: string
  document_id: string
  current_step?: number
  status?: string
}) {
  return db.insert(approvalInstances).values(values).returning()
}

export function findInstance(id: string) {
  return db.query.approvalInstances.findFirst({ where: eq(approvalInstances.id, id) })
}

export function findInstanceByDocument(documentType: string, documentId: string) {
  return db.query.approvalInstances.findFirst({
    where: (t, { and, eq }) => and(eq(t.document_type, documentType), eq(t.document_id, documentId)),
  })
}

export function updateInstance(id: string, values: Record<string, unknown>) {
  return db
    .update(approvalInstances)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(approvalInstances.id, id))
    .returning()
}

export function createLog(values: {
  instance_id: string
  step_order: number
  approver_id: string
  action: string
  note?: string | null
  approved_at: Date
}) {
  return db.insert(approvalInstanceLogs).values(values).returning()
}

export function listLogs(instanceId: string) {
  return db.select().from(approvalInstanceLogs).where(eq(approvalInstanceLogs.instance_id, instanceId))
}
