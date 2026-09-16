import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import {
  createAdjustment,
  createAdjustmentItem,
  findAdjustment,
  listAdjustmentItems,
  updateAdjustment,
  updateAdjustmentTx,
} from '../repositories/stock-adjustment.repository'
import { findInstanceByDocument } from '../repositories/approval-instance.repository'
import { createApprovalInstance, approveInstance, rejectInstance } from './approval.service'
import {
  consumeLayersFifo,
  createStockLayer,
  decrementStockSummaryGuarded,
  insertLedgerEntry,
  upsertStockSummaryOnReceive,
} from '../repositories/stock.repository'
import { failure } from '../utils/response'

export interface CreateAdjustmentItemInput {
  product_id: string
  qty_diff: number
  hpp?: number
}

export async function createAdjustmentWithItems(input: {
  warehouse_id: string
  adjustment_date: string
  reason?: string
  items: CreateAdjustmentItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('Adjustment harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }
  for (const item of input.items) {
    if (item.qty_diff === 0) {
      return failure('qty_diff tidak boleh 0', 'INVALID_QTY_DIFF', 400)
    }
    if (item.qty_diff > 0 && (item.hpp === undefined || item.hpp === null)) {
      return failure('hpp wajib diisi ketika qty_diff positif', 'HPP_REQUIRED', 400)
    }
  }

  const noAdjustment = `ADJ-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  const [adjustment] = await createAdjustment({
    no_adjustment: noAdjustment,
    warehouse_id: input.warehouse_id,
    adjustment_date: input.adjustment_date,
    reason: input.reason ?? null,
    status: 'draft',
  })

  const items = []
  for (const item of input.items) {
    const [row] = await createAdjustmentItem({
      adjustment_id: adjustment.id,
      product_id: item.product_id,
      qty_diff: item.qty_diff.toString(),
      hpp: item.qty_diff > 0 ? item.hpp!.toString() : null,
    })
    items.push(row)
  }

  return { ...adjustment, items }
}

export async function getAdjustmentWithItems(id: string) {
  const adjustment = await findAdjustment(id)
  if (!adjustment) return null
  const items = await listAdjustmentItems(id)
  return { ...adjustment, items }
}

export async function submitAdjustment(adjustmentId: string) {
  const adjustment = await findAdjustment(adjustmentId)
  if (!adjustment) return failure('Adjustment tidak ditemukan', 'NOT_FOUND', 404)
  if (adjustment.status !== 'draft') {
    return failure(`Adjustment tidak bisa disubmit dari status "${adjustment.status}"`, 'INVALID_STATUS', 400)
  }

  const instance = await createApprovalInstance('adjustment', adjustmentId)
  const rows = await updateAdjustment(adjustmentId, { status: 'waiting_approval' })
  return { adjustment: rows[0], approval_instance: instance }
}

// Applies every item's qty_diff on final approval, inside ONE DB
// transaction. Positive diffs create a brand-new stock_layer (source_type
// 'adjustment', hpp as provided). Negative diffs have no specific layer
// reference in the schema, so they consume active layers oldest-first
// (FIFO, §6.1) — row-locked via consumeLayersFifo so concurrent negative
// adjustments/returns/transfers on the same product+warehouse serialize
// instead of racing.
async function executeAdjustment(adjustmentId: string) {
  const adjustment = await findAdjustment(adjustmentId)
  if (!adjustment) return failure('Adjustment tidak ditemukan', 'NOT_FOUND', 404)

  const items = await listAdjustmentItems(adjustmentId)

  await db.transaction(async (tx) => {
    for (const item of items) {
      const qtyDiff = Number(item.qty_diff)

      if (qtyDiff > 0) {
        await createStockLayer(tx, {
          product_id: item.product_id,
          warehouse_id: adjustment.warehouse_id,
          source_type: 'adjustment',
          source_id: adjustment.id,
          receive_date: adjustment.adjustment_date,
          qty_original: qtyDiff.toString(),
          qty_remaining: qtyDiff.toString(),
          hpp: item.hpp!,
        })

        const value = (qtyDiff * Number(item.hpp)).toString()
        const summary = await upsertStockSummaryOnReceive(tx, {
          product_id: item.product_id,
          warehouse_id: adjustment.warehouse_id,
          qty: qtyDiff.toString(),
          value,
        })

        await insertLedgerEntry(tx, {
          product_id: item.product_id,
          warehouse_id: adjustment.warehouse_id,
          transaction_type: 'adjustment',
          reference_type: 'adjustment',
          reference_id: adjustment.id,
          reference_no: adjustment.no_adjustment,
          transaction_date: new Date(),
          qty_in: qtyDiff.toString(),
          hpp_used: item.hpp,
          running_balance_qty: summary.qty_on_hand,
          running_balance_value: summary.total_value,
        })
      } else {
        const qtyOut = Math.abs(qtyDiff)
        const consumption = await consumeLayersFifo(tx, item.product_id, adjustment.warehouse_id, qtyOut)
        const avgHpp = consumption.totalCost / qtyOut

        const summary = await decrementStockSummaryGuarded(tx, {
          product_id: item.product_id,
          warehouse_id: adjustment.warehouse_id,
          qty: qtyOut.toString(),
          value: consumption.totalCost.toString(),
        })

        await insertLedgerEntry(tx, {
          product_id: item.product_id,
          warehouse_id: adjustment.warehouse_id,
          transaction_type: 'adjustment',
          reference_type: 'adjustment',
          reference_id: adjustment.id,
          reference_no: adjustment.no_adjustment,
          transaction_date: new Date(),
          qty_out: qtyOut.toString(),
          hpp_used: avgHpp.toString(),
          running_balance_qty: summary.qty_on_hand,
          running_balance_value: summary.total_value,
        })
      }
    }

    await updateAdjustmentTx(tx, adjustmentId, { status: 'approved' })
  })

  return getAdjustmentWithItems(adjustmentId)
}

export async function approveAdjustment(adjustmentId: string, approverId: string, note?: string) {
  const adjustment = await findAdjustment(adjustmentId)
  if (!adjustment) return failure('Adjustment tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('adjustment', adjustmentId)
  if (!instance) return failure('Approval instance untuk adjustment ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  const updatedInstance = await approveInstance(instance.id, approverId, note)

  if (updatedInstance.status === 'approved') {
    return executeAdjustment(adjustmentId)
  }

  return getAdjustmentWithItems(adjustmentId)
}

export async function rejectAdjustment(adjustmentId: string, approverId: string, note?: string) {
  const adjustment = await findAdjustment(adjustmentId)
  if (!adjustment) return failure('Adjustment tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('adjustment', adjustmentId)
  if (!instance) return failure('Approval instance untuk adjustment ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  await rejectInstance(instance.id, approverId, note)
  const rows = await updateAdjustment(adjustmentId, { status: 'rejected' })
  return rows[0]
}
