import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { approvalInstances, approvalInstanceLogs } from '../db/schema'

// Every write here can optionally run against a transaction handle instead
// of the top-level `db`, so callers that need the approval-instance state
// change to commit-or-rollback together with a business-logic mutation
// (e.g. stock-adjustment execution) can pass their `tx` through instead of
// having the instance update commit on its own ahead of time. Derived from
// db.transaction's own callback parameter (rather than the generic
// `PgTransaction<any, any, any>`) so the schema generic — and therefore
// `.query.*` typing — is preserved.
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export function createInstance(
  values: {
    workflow_id: string
    document_type: string
    document_id: string
    current_step?: number
    status?: string
  },
  executor: Executor = db,
) {
  return executor.insert(approvalInstances).values(values).returning()
}

export function findInstance(id: string, executor: Executor = db) {
  return executor.query.approvalInstances.findFirst({ where: eq(approvalInstances.id, id) })
}

export function findInstanceByDocument(documentType: string, documentId: string, executor: Executor = db) {
  return executor.query.approvalInstances.findFirst({
    where: (t, { and, eq }) => and(eq(t.document_type, documentType), eq(t.document_id, documentId)),
    orderBy: (t, { desc }) => desc(t.created_at),
  })
}

export function updateInstance(id: string, values: Record<string, unknown>, executor: Executor = db) {
  return executor
    .update(approvalInstances)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(approvalInstances.id, id))
    .returning()
}

export function createLog(
  values: {
    instance_id: string
    step_order: number
    approver_id: string
    action: string
    note?: string | null
    approved_at: Date
  },
  executor: Executor = db,
) {
  return executor.insert(approvalInstanceLogs).values(values).returning()
}

export function listLogs(instanceId: string) {
  return db.select().from(approvalInstanceLogs).where(eq(approvalInstanceLogs.instance_id, instanceId))
}
