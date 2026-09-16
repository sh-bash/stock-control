import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import {
  createReceiving,
  createReceivingItem,
  findReceiving,
  listReceivingItems,
  setReceivingItemLayer,
  updateReceiving,
  updateReceivingTx,
} from '../repositories/receiving.repository'
import { findInstanceByDocument } from '../repositories/approval-instance.repository'
import { createApprovalInstance, approveInstance, rejectInstance } from './approval.service'
import { incrementQtyReceived, findItem as findPoItem } from '../repositories/purchase-order.repository'
import { recalculatePurchaseOrderStatus } from './purchase-order.service'
import { findShipmentItem } from '../repositories/shipment.repository'
import { createStockLayer, insertLedgerEntry, upsertStockSummaryOnReceive } from '../repositories/stock.repository'
import { failure } from '../utils/response'

export interface CreateReceivingItemInput {
  shipment_item_id: string
  po_item_id: string
  product_id: string
  qty_received: number
}

export async function createReceivingWithItems(input: {
  shipment_id: string
  warehouse_id: string
  receive_date: string
  created_by: string
  items: CreateReceivingItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('Receiving harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }

  const noReceiving = `RCV-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  const [receiving] = await createReceiving({
    no_receiving: noReceiving,
    shipment_id: input.shipment_id,
    warehouse_id: input.warehouse_id,
    receive_date: input.receive_date,
    created_by: input.created_by,
    status: 'draft',
  })

  const items = []
  for (const item of input.items) {
    const shipmentItem = await findShipmentItem(item.shipment_item_id)
    if (!shipmentItem) return failure('shipment_item_id tidak ditemukan', 'NOT_FOUND', 404)
    const poItem = await findPoItem(item.po_item_id)
    if (!poItem) return failure('po_item_id tidak ditemukan', 'NOT_FOUND', 404)

    const unitPrice = poItem.unit_price
    const shippingCostPerUnit = shipmentItem.allocated_shipping_cost_per_unit ?? '0'
    const hpp = (Number(unitPrice) + Number(shippingCostPerUnit)).toString()

    const [row] = await createReceivingItem({
      receiving_id: receiving.id,
      shipment_item_id: item.shipment_item_id,
      po_item_id: item.po_item_id,
      product_id: item.product_id,
      qty_received: item.qty_received.toString(),
      unit_price: unitPrice,
      shipping_cost_per_unit: shippingCostPerUnit,
      hpp,
    })
    items.push(row)
  }

  return { ...receiving, items }
}

export async function getReceivingWithItems(id: string) {
  const receiving = await findReceiving(id)
  if (!receiving) return null
  const items = await listReceivingItems(id)
  return { ...receiving, items }
}

export async function submitReceiving(receivingId: string) {
  const receiving = await findReceiving(receivingId)
  if (!receiving) return failure('Receiving tidak ditemukan', 'NOT_FOUND', 404)
  if (receiving.status !== 'draft') {
    return failure(`Receiving tidak bisa disubmit dari status "${receiving.status}"`, 'INVALID_STATUS', 400)
  }

  const instance = await createApprovalInstance('receiving', receivingId)
  const rows = await updateReceiving(receivingId, { status: 'waiting_approval' })
  return { receiving: rows[0], approval_instance: instance }
}

// Implements PRD §6.2 receiveStock — executed once the receiving is fully
// approved. Every stock_layer / stock_ledger / stock_summary write for the
// whole receiving happens inside ONE DB transaction with row-level locks
// (SELECT ... FOR UPDATE on stock_summary) so a partial failure never leaves
// stock in an inconsistent state.
async function receiveStock(receivingId: string) {
  const receiving = await findReceiving(receivingId)
  if (!receiving) return failure('Receiving tidak ditemukan', 'NOT_FOUND', 404)

  const items = await listReceivingItems(receivingId)
  const affectedPoIds = new Set<string>()

  await db.transaction(async (tx) => {
    for (const item of items) {
      const [layer] = await createStockLayer(tx, {
        product_id: item.product_id,
        warehouse_id: receiving.warehouse_id,
        source_type: 'receiving',
        source_id: receiving.id,
        receive_date: receiving.receive_date,
        qty_original: item.qty_received,
        qty_remaining: item.qty_received,
        hpp: item.hpp,
      })

      const value = (Number(item.qty_received) * Number(item.hpp)).toString()
      const summary = await upsertStockSummaryOnReceive(tx, {
        product_id: item.product_id,
        warehouse_id: receiving.warehouse_id,
        qty: item.qty_received,
        value,
      })

      await insertLedgerEntry(tx, {
        product_id: item.product_id,
        warehouse_id: receiving.warehouse_id,
        transaction_type: 'receiving',
        reference_type: 'receiving',
        reference_id: receiving.id,
        reference_no: receiving.no_receiving,
        transaction_date: new Date(),
        qty_in: item.qty_received,
        hpp_used: item.hpp,
        running_balance_qty: summary!.qty_on_hand,
        running_balance_value: summary!.total_value,
      })

      await setReceivingItemLayer(tx, item.id, layer.id)

      const poItem = await incrementQtyReceived(tx, item.po_item_id, Number(item.qty_received))
      if (poItem[0]) affectedPoIds.add(poItem[0].po_id)
    }

    await updateReceivingTx(tx, receivingId, { status: 'approved' })
  })

  for (const poId of affectedPoIds) {
    await recalculatePurchaseOrderStatus(poId)
  }

  return getReceivingWithItems(receivingId)
}

export async function approveReceiving(receivingId: string, approverId: string, note?: string) {
  const receiving = await findReceiving(receivingId)
  if (!receiving) return failure('Receiving tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('receiving', receivingId)
  if (!instance) return failure('Approval instance untuk receiving ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  const updatedInstance = await approveInstance(instance.id, approverId, note)

  if (updatedInstance.status === 'approved') {
    return receiveStock(receivingId)
  }

  return getReceivingWithItems(receivingId)
}

export async function rejectReceiving(receivingId: string, approverId: string, note?: string) {
  const receiving = await findReceiving(receivingId)
  if (!receiving) return failure('Receiving tidak ditemukan', 'NOT_FOUND', 404)

  const instance = await findInstanceByDocument('receiving', receivingId)
  if (!instance) return failure('Approval instance untuk receiving ini tidak ditemukan', 'NO_APPROVAL_INSTANCE', 400)

  await rejectInstance(instance.id, approverId, note)
  const rows = await updateReceiving(receivingId, { status: 'rejected' })
  return rows[0]
}
