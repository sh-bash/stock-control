import { randomUUID } from 'node:crypto'
import {
  createOrder,
  createItem,
  findOrder,
  listItems,
  updateOrder,
} from '../repositories/purchase-order.repository'
import { findInstanceByDocument } from '../repositories/approval-instance.repository'
import { createApprovalInstance, approveInstance, rejectInstance } from './approval.service'
import { failure } from '../utils/response'

export interface CreatePoItemInput {
  product_id: string
  qty_order: number
  unit_price: number
}

export async function createPurchaseOrder(input: {
  supplier_id: string
  warehouse_id: string
  order_date: string
  created_by: string
  items: CreatePoItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('PO harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }

  const noPo = `PO-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  const [po] = await createOrder({
    no_po: noPo,
    supplier_id: input.supplier_id,
    warehouse_id: input.warehouse_id,
    order_date: input.order_date,
    created_by: input.created_by,
    status: 'draft',
  })

  const items = []
  for (const item of input.items) {
    const [row] = await createItem({
      po_id: po.id,
      product_id: item.product_id,
      qty_order: item.qty_order.toString(),
      unit_price: item.unit_price.toString(),
    })
    items.push(row)
  }

  return { ...po, items }
}

export async function getPurchaseOrderWithItems(id: string) {
  const po = await findOrder(id)
  if (!po) return null
  const items = await listItems(id)
  return { ...po, items }
}

export async function submitPurchaseOrder(poId: string) {
  const po = await findOrder(poId)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)
  if (po.status !== 'draft') {
    return failure(`PO tidak bisa disubmit dari status "${po.status}"`, 'INVALID_STATUS', 400)
  }

  const instance = await createApprovalInstance('po', poId)
  const rows = await updateOrder(poId, { status: 'waiting_approval' })
  return { po: rows[0], approval_instance: instance }
}

export async function approvePurchaseOrder(poId: string, approverId: string, note?: string) {
  const po = await findOrder(poId)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('po', poId)
  if (!instance) return failure('Approval instance untuk PO ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  const updatedInstance = await approveInstance(instance.id, approverId, note)

  if (updatedInstance.status === 'approved') {
    const rows = await updateOrder(poId, { status: 'approved' })
    return rows[0]
  }

  return po
}

export async function rejectPurchaseOrder(poId: string, approverId: string, note?: string) {
  const po = await findOrder(poId)
  if (!po) return failure('PO tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('po', poId)
  if (!instance) return failure('Approval instance untuk PO ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  await rejectInstance(instance.id, approverId, note)
  const rows = await updateOrder(poId, { status: 'rejected' })
  return rows[0]
}

export async function recalculatePurchaseOrderStatus(poId: string) {
  const po = await findOrder(poId)
  if (!po) return
  if (po.status !== 'approved' && po.status !== 'partial_received') return

  const items = await listItems(poId)
  const totalOrdered = items.reduce((sum, i) => sum + Number(i.qty_order), 0)
  const totalReceived = items.reduce((sum, i) => sum + Number(i.qty_received), 0)

  let newStatus = po.status
  if (totalReceived >= totalOrdered && totalOrdered > 0) {
    newStatus = 'closed'
  } else if (totalReceived > 0) {
    newStatus = 'partial_received'
  }

  if (newStatus !== po.status) {
    await updateOrder(poId, { status: newStatus })
  }
}
