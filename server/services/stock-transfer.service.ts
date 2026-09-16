import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import {
  createTransfer,
  createTransferItem,
  findTransfer,
  listTransferItems,
  updateTransferTx,
} from '../repositories/stock-transfer.repository'
import {
  createStockLayer,
  decrementLayerQty,
  decrementStockSummaryGuarded,
  getLayerForUpdate,
  insertLedgerEntry,
  upsertStockSummaryOnReceive,
} from '../repositories/stock.repository'
import { failure } from '../utils/response'

export interface CreateTransferItemInput {
  product_id: string
  stock_layer_id: string
  qty: number
}

export async function createAndExecuteTransfer(input: {
  from_warehouse_id: string
  to_warehouse_id: string
  transfer_date: string
  items: CreateTransferItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('Transfer harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }
  if (input.from_warehouse_id === input.to_warehouse_id) {
    return failure('from_warehouse_id dan to_warehouse_id tidak boleh sama', 'SAME_WAREHOUSE', 400)
  }

  const noTransfer = `TRF-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  const [transfer] = await createTransfer({
    no_transfer: noTransfer,
    from_warehouse_id: input.from_warehouse_id,
    to_warehouse_id: input.to_warehouse_id,
    transfer_date: input.transfer_date,
    status: 'draft',
  })

  for (const item of input.items) {
    await createTransferItem({
      transfer_id: transfer.id,
      product_id: item.product_id,
      stock_layer_id: item.stock_layer_id,
      qty: item.qty.toString(),
    })
  }

  // Implements PRD §5.4/§7 Fase 4 stock transfer: move a specific layer's
  // qty between warehouses inside ONE transaction with row-level locks —
  // decrement the source layer, create a brand-new layer at the destination
  // (source_type='transfer_in', cost basis preserved from the source layer),
  // and post two ledger entries (transfer_out / transfer_in).
  await db.transaction(async (tx) => {
    for (const item of input.items) {
      const layer = await getLayerForUpdate(tx, item.stock_layer_id)
      if (!layer) return failure('stock_layer tidak ditemukan', 'NOT_FOUND', 404)
      if (layer.warehouse_id !== input.from_warehouse_id) {
        return failure('stock_layer tidak berada di from_warehouse_id', 'WAREHOUSE_MISMATCH', 400)
      }
      if (layer.product_id !== item.product_id) {
        return failure('product_id tidak sesuai dengan stock_layer yang dipilih', 'PRODUCT_LAYER_MISMATCH', 400)
      }
      if (Number(layer.qty_remaining) < item.qty) {
        return failure('qty transfer melebihi qty_remaining pada stock_layer saat ini', 'INSUFFICIENT_STOCK', 400)
      }

      const newRemaining = (Number(layer.qty_remaining) - item.qty).toString()
      await decrementLayerQty(tx, layer.id, newRemaining)

      const value = (item.qty * Number(layer.hpp)).toString()

      const fromSummary = await decrementStockSummaryGuarded(tx, {
        product_id: item.product_id,
        warehouse_id: input.from_warehouse_id,
        qty: item.qty.toString(),
        value,
      })

      await insertLedgerEntry(tx, {
        product_id: item.product_id,
        warehouse_id: input.from_warehouse_id,
        transaction_type: 'transfer_out',
        reference_type: 'transfer',
        reference_id: transfer.id,
        reference_no: transfer.no_transfer,
        transaction_date: new Date(),
        qty_out: item.qty.toString(),
        hpp_used: layer.hpp,
        running_balance_qty: fromSummary.qty_on_hand,
        running_balance_value: fromSummary.total_value,
      })

      await createStockLayer(tx, {
        product_id: item.product_id,
        warehouse_id: input.to_warehouse_id,
        source_type: 'transfer_in',
        source_id: transfer.id,
        receive_date: input.transfer_date,
        qty_original: item.qty.toString(),
        qty_remaining: item.qty.toString(),
        hpp: layer.hpp,
      })
      const toSummary = await upsertStockSummaryOnReceive(tx, {
        product_id: item.product_id,
        warehouse_id: input.to_warehouse_id,
        qty: item.qty.toString(),
        value,
      })

      await insertLedgerEntry(tx, {
        product_id: item.product_id,
        warehouse_id: input.to_warehouse_id,
        transaction_type: 'transfer_in',
        reference_type: 'transfer',
        reference_id: transfer.id,
        reference_no: transfer.no_transfer,
        transaction_date: new Date(),
        qty_in: item.qty.toString(),
        hpp_used: layer.hpp,
        running_balance_qty: toSummary.qty_on_hand,
        running_balance_value: toSummary.total_value,
      })
    }

    await updateTransferTx(tx, transfer.id, { status: 'completed' })
  })

  return getTransferWithItems(transfer.id)
}

export async function getTransferWithItems(id: string) {
  const transfer = await findTransfer(id)
  if (!transfer) return null
  const items = await listTransferItems(id)
  return { ...transfer, items }
}
