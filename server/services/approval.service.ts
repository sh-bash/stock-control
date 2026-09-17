import { db } from '../db/client'
import {
  findActiveWorkflowByDocumentType,
  listSteps,
} from '../repositories/approval-workflow.repository'
import {
  createInstance,
  createLog,
  findInstanceForUpdate,
  updateInstance,
} from '../repositories/approval-instance.repository'
import { findUserById } from '../repositories/user.repository'
import { failure } from '../utils/response'

// Derived from db.transaction's own callback parameter so it matches the
// Executor type in approval-instance.repository.ts exactly (a generic
// `PgTransaction<any, any, any>` erases the schema generic and breaks
// `.query.*` typing there).
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function createApprovalInstance(documentType: string, documentId: string) {
  const workflow = await findActiveWorkflowByDocumentType(documentType)
  if (!workflow) {
    return failure(
      `Tidak ada approval workflow aktif untuk document_type "${documentType}"`,
      'NO_ACTIVE_WORKFLOW',
      400,
    )
  }

  const steps = await listSteps(workflow.id)
  if (steps.length === 0) {
    return failure(`Workflow "${workflow.name}" belum punya approval step`, 'NO_APPROVAL_STEP', 400)
  }

  const rows = await createInstance({
    workflow_id: workflow.id,
    document_type: documentType,
    document_id: documentId,
    current_step: 1,
    status: 'pending',
  })
  return rows[0]
}

async function assertApprover(workflowId: string, stepOrder: number, approverUserId: string) {
  const steps = await listSteps(workflowId)
  const step = steps.find((s) => s.step_order === stepOrder)
  if (!step) return failure('Step approval tidak ditemukan', 'STEP_NOT_FOUND', 404)

  const user = await findUserById(approverUserId)
  if (!user) return failure('User approver tidak ditemukan', 'USER_NOT_FOUND', 404)

  const isAuthorized =
    (step.approver_type === 'user' && step.approver_id === approverUserId) ||
    (step.approver_type === 'role' && step.approver_id === user.role_id)

  if (!isAuthorized) {
    return failure('Kamu bukan approver untuk step ini', 'NOT_AUTHORIZED_APPROVER', 403)
  }

  return step
}

// `executor` lets a caller pass its own transaction handle so the instance's
// status flip commits atomically together with whatever business mutation
// it gates (e.g. stock-adjustment execution). Without this, the instance
// could commit as 'approved' via a separate statement, then the business
// transaction fails and rolls back — leaving the document permanently stuck
// (instance no longer 'pending', so it can never be approved or rejected
// again, but the document itself never advanced past 'waiting_approval').
//
// The instance is read via findInstanceForUpdate (SELECT ... FOR UPDATE),
// not a plain read, so two concurrent approve calls on the same instance
// can't both see status='pending' and both proceed — the second blocks on
// the row lock until the first's transaction commits, then correctly sees
// 'approved'/'rejected' and rejects instead of re-running the business
// mutation it gates.
export async function approveInstance(
  instanceId: string,
  approverUserId: string,
  note?: string,
  executor: Executor = db,
) {
  const instance = await findInstanceForUpdate(instanceId, executor)
  if (!instance) return failure('Approval instance tidak ditemukan', 'NOT_FOUND', 404)
  if (instance.status !== 'pending') {
    return failure(`Approval instance sudah berstatus "${instance.status}"`, 'INSTANCE_NOT_PENDING', 400)
  }

  const step = await assertApprover(instance.workflow_id, instance.current_step, approverUserId)

  await createLog(
    {
      instance_id: instance.id,
      step_order: instance.current_step,
      approver_id: approverUserId,
      action: 'approve',
      note: note ?? null,
      approved_at: new Date(),
    },
    executor,
  )

  const steps = await listSteps(instance.workflow_id)
  const isLastStep = instance.current_step >= steps.length

  const rows = await updateInstance(
    instance.id,
    {
      current_step: isLastStep ? instance.current_step : instance.current_step + 1,
      status: isLastStep ? 'approved' : 'pending',
    },
    executor,
  )

  return rows[0]
}

export async function rejectInstance(
  instanceId: string,
  approverUserId: string,
  note?: string,
  executor: Executor = db,
) {
  const instance = await findInstanceForUpdate(instanceId, executor)
  if (!instance) return failure('Approval instance tidak ditemukan', 'NOT_FOUND', 404)
  if (instance.status !== 'pending') {
    return failure(`Approval instance sudah berstatus "${instance.status}"`, 'INSTANCE_NOT_PENDING', 400)
  }

  await assertApprover(instance.workflow_id, instance.current_step, approverUserId)

  await createLog(
    {
      instance_id: instance.id,
      step_order: instance.current_step,
      approver_id: approverUserId,
      action: 'reject',
      note: note ?? null,
      approved_at: new Date(),
    },
    executor,
  )

  const rows = await updateInstance(instance.id, { status: 'rejected' }, executor)
  return rows[0]
}
