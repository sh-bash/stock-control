import { randomUUID } from 'node:crypto'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import {
  createReturn,
  createReturnItem,
  findReturn,
  listReturnItems,
  updateReturn,
  updateReturnTx,
} from '../repositories/purchase-return.repository'
import { findInstanceByDocument } from '../repositories/approval-instance.repository'
import { createApprovalInstance, approveInstance, rejectInstance } from './approval.service'
import {
  decrementLayerQty,
  decrementStockSummaryGuarded,
  getLayerForUpdate,
  insertLedgerEntry,
} from '../repositories/stock.repository'
import { findReceiving } from '../repositories/receiving.repository'
import { checkAndNotifyStockThreshold } from './stock.service'
import { failure } from '../utils/response'

export interface CreatePurchaseReturnItemInput {
  product_id: string
  stock_layer_id: string
  qty_return: number
}

export async function createPurchaseReturnWithItems(input: {
  receiving_id: string
  warehouse_id: string
  return_date: string
  reason?: string
  items: CreatePurchaseReturnItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('Purchase return harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }

  const receiving = await findReceiving(input.receiving_id)
  if (!receiving) return failure('Receiving tidak ditemukan', 'NOT_FOUND', 404)
  if (receiving.status !== 'approved') {
    return failure('Purchase return hanya bisa dibuat dari receiving yang sudah approved', 'RECEIVING_NOT_APPROVED', 400)
  }

  const noReturn = `PR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  const [ret] = await createReturn({
    no_return: noReturn,
    receiving_id: input.receiving_id,
    warehouse_id: input.warehouse_id,
    return_date: input.return_date,
    reason: input.reason ?? null,
    status: 'draft',
  })

  const items = []
  for (const item of input.items) {
    const layer = await db.query.stockLayers.findFirst({
      where: (t, { eq }) => eq(t.id, item.stock_layer_id),
    })
    if (!layer) return failure('stock_layer_id tidak ditemukan', 'NOT_FOUND', 404)
    if (layer.product_id !== item.product_id) {
      return failure('product_id tidak sesuai dengan stock_layer yang dipilih', 'PRODUCT_LAYER_MISMATCH', 400)
    }
    if (layer.warehouse_id !== input.warehouse_id) {
      return failure('stock_layer berada di warehouse yang berbeda dari return ini', 'WAREHOUSE_MISMATCH', 400)
    }
    if (layer.source_type !== 'receiving' || layer.source_id !== input.receiving_id) {
      return failure('stock_layer yang dipilih bukan berasal dari receiving ini', 'LAYER_NOT_FROM_RECEIVING', 400)
    }
    if (Number(layer.qty_remaining) < item.qty_return) {
      return failure('qty_return melebihi qty_remaining pada stock_layer', 'INSUFFICIENT_STOCK', 400)
    }

    const [row] = await createReturnItem({
      return_id: ret.id,
      product_id: item.product_id,
      stock_layer_id: item.stock_layer_id,
      qty_return: item.qty_return.toString(),
    })
    items.push(row)
  }

  return { ...ret, items }
}

export async function getPurchaseReturnWithItems(id: string) {
  const ret = await findReturn(id)
  if (!ret) return null
  const items = await listReturnItems(id)
  return { ...ret, items }
}

export async function submitPurchaseReturn(returnId: string) {
  const ret = await findReturn(returnId)
  if (!ret) return failure('Purchase return tidak ditemukan', 'NOT_FOUND', 404)
  if (ret.status !== 'draft') {
    return failure(`Purchase return tidak bisa disubmit dari status "${ret.status}"`, 'INVALID_STATUS', 400)
  }

  const instance = await createApprovalInstance('purchase_return', returnId)
  const rows = await updateReturn(returnId, { status: 'waiting_approval' })
  return { purchase_return: rows[0], approval_instance: instance }
}

// Executes the actual stock mutation (decrement the specific referenced
// layer + stock_summary + ledger entry) once the return is fully approved.
// Takes the caller's transaction (see approvePurchaseReturn) so the
// approval-instance status flip and every stock write commit-or-rollback
// together — see the comment on receiveStock in receiving.service.ts for
// why a separate transaction here would let a document get permanently
// stuck between approval-instance and document status.
async function executePurchaseReturn(tx: PgTransaction<any, any, any>, returnId: string) {
  const ret = await findReturn(returnId)
  if (!ret) return failure('Purchase return tidak ditemukan', 'NOT_FOUND', 404)

  const items = await listReturnItems(returnId)

  for (const item of items) {
    const layer = await getLayerForUpdate(tx, item.stock_layer_id)
    if (!layer) return failure('stock_layer tidak ditemukan', 'NOT_FOUND', 404)
    if (Number(layer.qty_remaining) < Number(item.qty_return)) {
      return failure('qty_return melebihi qty_remaining pada stock_layer saat ini', 'INSUFFICIENT_STOCK', 400)
    }

    const newRemaining = (Number(layer.qty_remaining) - Number(item.qty_return)).toString()
    await decrementLayerQty(tx, layer.id, newRemaining)

    const value = (Number(item.qty_return) * Number(layer.hpp)).toString()
    const summary = await decrementStockSummaryGuarded(tx, {
      product_id: item.product_id,
      warehouse_id: ret.warehouse_id,
      qty: item.qty_return,
      value,
    })

    await insertLedgerEntry(tx, {
      product_id: item.product_id,
      warehouse_id: ret.warehouse_id,
      transaction_type: 'purchase_return',
      reference_type: 'purchase_return',
      reference_id: ret.id,
      reference_no: ret.no_return,
      transaction_date: new Date(),
      qty_out: item.qty_return,
      hpp_used: layer.hpp,
      running_balance_qty: summary.qty_on_hand,
      running_balance_value: summary.total_value,
    })
  }

  await updateReturnTx(tx, returnId, { status: 'approved' })
}

export async function approvePurchaseReturn(returnId: string, approverId: string, note?: string) {
  const ret = await findReturn(returnId)
  if (!ret) return failure('Purchase return tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('purchase_return', returnId)
  if (!instance) return failure('Approval instance untuk purchase return ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  const wasExecuted = await db.transaction(async (tx) => {
    const updatedInstance = await approveInstance(instance.id, approverId, note, tx)

    if (updatedInstance.status === 'approved') {
      await executePurchaseReturn(tx, returnId)
      return true
    }

    return false
  })

  if (wasExecuted) {
    const items = await listReturnItems(returnId)
    const affectedProducts = new Set(items.map((i) => i.product_id))
    for (const productId of affectedProducts) {
      await checkAndNotifyStockThreshold(productId, ret.warehouse_id)
    }
  }

  return getPurchaseReturnWithItems(returnId)
}

export async function rejectPurchaseReturn(returnId: string, approverId: string, note?: string) {
  const ret = await findReturn(returnId)
  if (!ret) return failure('Purchase return tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('purchase_return', returnId)
  if (!instance) return failure('Approval instance untuk purchase return ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  return db.transaction(async (tx) => {
    await rejectInstance(instance.id, approverId, note, tx)
    const rows = await updateReturnTx(tx, returnId, { status: 'rejected' })
    return rows[0]
  })
}
