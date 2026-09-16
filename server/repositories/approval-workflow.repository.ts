import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { approvalWorkflows, approvalSteps } from '../db/schema'

export function listWorkflows() {
  return db.select().from(approvalWorkflows)
}

export function findWorkflow(id: string) {
  return db.query.approvalWorkflows.findFirst({ where: eq(approvalWorkflows.id, id) })
}

export function findActiveWorkflowByDocumentType(documentType: string) {
  return db.query.approvalWorkflows.findFirst({
    where: and(eq(approvalWorkflows.document_type, documentType), eq(approvalWorkflows.is_active, true)),
  })
}

export function createWorkflow(values: { document_type: string; name: string; is_active?: boolean }) {
  return db.insert(approvalWorkflows).values(values).returning()
}

export function updateWorkflow(id: string, values: Record<string, unknown>) {
  return db
    .update(approvalWorkflows)
    .set({ ...values, updated_at: new Date() } as any)
    .where(eq(approvalWorkflows.id, id))
    .returning()
}

export function deleteWorkflow(id: string) {
  return db.delete(approvalWorkflows).where(eq(approvalWorkflows.id, id)).returning()
}

export function listSteps(workflowId: string) {
  return db
    .select()
    .from(approvalSteps)
    .where(eq(approvalSteps.workflow_id, workflowId))
    .orderBy(asc(approvalSteps.step_order))
}

export function findStep(workflowId: string, stepOrder: number) {
  return db.query.approvalSteps.findFirst({
    where: and(eq(approvalSteps.workflow_id, workflowId), eq(approvalSteps.step_order, stepOrder)),
  })
}

export function createStep(values: { workflow_id: string; step_order: number; approver_type: string; approver_id: string }) {
  return db.insert(approvalSteps).values(values).returning()
}

export function deleteStep(id: string) {
  return db.delete(approvalSteps).where(eq(approvalSteps.id, id)).returning()
}

export function countSteps(workflowId: string) {
  return db.select().from(approvalSteps).where(eq(approvalSteps.workflow_id, workflowId))
}
