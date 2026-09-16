import {
  findActiveWorkflowByDocumentType,
  listSteps,
} from '../repositories/approval-workflow.repository'
import {
  createInstance,
  createLog,
  findInstance,
  updateInstance,
} from '../repositories/approval-instance.repository'
import { findUserById } from '../repositories/user.repository'
import { failure } from '../utils/response'

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

export async function approveInstance(instanceId: string, approverUserId: string, note?: string) {
  const instance = await findInstance(instanceId)
  if (!instance) return failure('Approval instance tidak ditemukan', 'NOT_FOUND', 404)
  if (instance.status !== 'pending') {
    return failure(`Approval instance sudah berstatus "${instance.status}"`, 'INSTANCE_NOT_PENDING', 400)
  }

  const step = await assertApprover(instance.workflow_id, instance.current_step, approverUserId)

  await createLog({
    instance_id: instance.id,
    step_order: instance.current_step,
    approver_id: approverUserId,
    action: 'approve',
    note: note ?? null,
    approved_at: new Date(),
  })

  const steps = await listSteps(instance.workflow_id)
  const isLastStep = instance.current_step >= steps.length

  const rows = await updateInstance(instance.id, {
    current_step: isLastStep ? instance.current_step : instance.current_step + 1,
    status: isLastStep ? 'approved' : 'pending',
  })

  return rows[0]
}

export async function rejectInstance(instanceId: string, approverUserId: string, note?: string) {
  const instance = await findInstance(instanceId)
  if (!instance) return failure('Approval instance tidak ditemukan', 'NOT_FOUND', 404)
  if (instance.status !== 'pending') {
    return failure(`Approval instance sudah berstatus "${instance.status}"`, 'INSTANCE_NOT_PENDING', 400)
  }

  await assertApprover(instance.workflow_id, instance.current_step, approverUserId)

  await createLog({
    instance_id: instance.id,
    step_order: instance.current_step,
    approver_id: approverUserId,
    action: 'reject',
    note: note ?? null,
    approved_at: new Date(),
  })

  const rows = await updateInstance(instance.id, { status: 'rejected' })
  return rows[0]
}
