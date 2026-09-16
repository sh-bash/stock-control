import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import {
  createReturn,
  createReturnItem,
  findReturn,
  listReturnItems,
  findDoItemCogs,
  findSoConsumptionHpp,
  findSoItemByProduct,
  findDoItemByProduct,
  sumReturnedQty,
} from '../repositories/sale-return.repository'
import {
  getOrderForUpdate as getSoForUpdate,
  findOrder as findSaleOrder,
} from '../repositories/sale-order.repository'
import {
  getOrderForUpdate as getDoForUpdate,
  findOrder as findDeliveryOrder,
} from '../repositories/delivery-order.repository'
import { createStockLayer, insertLedgerEntry, upsertStockSummaryOnReceive } from '../repositories/stock.repository'
import { checkAndNotifyStockThreshold } from './stock.service'
import { failure } from '../utils/response'

export interface CreateSaleReturnItemInput {
  product_id: string
  qty_return: number
}

async function resolveSourceContext(sourceType: string, sourceId: string) {
  if (sourceType === 'so') {
    const so = await findSaleOrder(sourceId)
    if (!so) return failure('SO (source) tidak ditemukan', 'NOT_FOUND', 404)
    return { warehouseId: so.warehouse_id }
  }
  if (sourceType === 'do') {
    const deliveryOrder = await findDeliveryOrder(sourceId)
    if (!deliveryOrder) return failure('DO (source) tidak ditemukan', 'NOT_FOUND', 404)
    return { warehouseId: deliveryOrder.warehouse_id }
  }
  return failure('source_type harus "so" atau "do"', 'INVALID_SOURCE_TYPE', 400)
}

// restore_hpp must be the ORIGINAL cost of the outbound transaction being
// returned — never today's weighted-average cost (§4.2 / §6.4 note) — so it
// is resolved once, at return time, from the source's own recorded cost.
async function resolveRestoreHpp(sourceType: string, sourceId: string, productId: string) {
  if (sourceType === 'do') {
    const cogs = await findDoItemCogs(sourceId, productId)
    if (cogs == null) {
      return failure(
        'DO ini belum approved untuk product tersebut (belum ada cogs_per_unit tercatat)',
        'NO_COGS_RECORDED',
        400,
      )
    }
    return cogs
  }
  const hpp = await findSoConsumptionHpp(sourceId, productId)
  if (hpp == null) {
    return failure(
      'Tidak ditemukan transaksi keluar untuk SO+product ini (SO mungkin belum confirmed atau memakai DO)',
      'NO_COGS_RECORDED',
      400,
    )
  }
  return hpp
}

async function resolveDeliveredQty(sourceType: string, sourceId: string, productId: string) {
  if (sourceType === 'do') {
    const doItem = await findDoItemByProduct(sourceId, productId)
    return doItem ? Number(doItem.qty_delivered) : 0
  }
  const soItem = await findSoItemByProduct(sourceId, productId)
  return soItem ? Number(soItem.qty_delivered) : 0
}

export async function createAndProcessSaleReturn(input: {
  source_type: 'so' | 'do'
  source_id: string
  return_date: string
  condition: 'good' | 'damaged'
  items: CreateSaleReturnItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('Sale return harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }

  const context = await resolveSourceContext(input.source_type, input.source_id)

  const returnId = randomUUID()
  const noReturn = `SR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  // Everything — the source row lock, the "how much is left to return"
  // check, creating the return + its items, and (for condition='good') the
  // stock_layer/stock_summary/ledger writes — happens in ONE transaction.
  // Locking the source (so/do) row first serializes concurrent returns
  // against the same source, so two requests can't both read "3 of 4
  // already returned" and each add more, together exceeding what was ever
  // delivered.
  await db.transaction(async (tx) => {
    if (input.source_type === 'so') {
      await getSoForUpdate(tx, input.source_id)
    } else {
      await getDoForUpdate(tx, input.source_id)
    }

    const resolvedItems: { product_id: string; qty_return: number; restore_hpp: string }[] = []
    for (const item of input.items) {
      const delivered = await resolveDeliveredQty(input.source_type, input.source_id, item.product_id)
      const alreadyReturned = await sumReturnedQty(tx, input.source_type, input.source_id, item.product_id)
      const remaining = delivered - alreadyReturned
      if (item.qty_return > remaining) {
        return failure(
          `qty_return (${item.qty_return}) melebihi sisa yang bisa diretur untuk product ini ` +
            `(terkirim ${delivered}, sudah diretur ${alreadyReturned}, sisa ${remaining})`,
          'EXCEEDS_RETURNABLE_QTY',
          400,
        )
      }
      const restoreHpp = await resolveRestoreHpp(input.source_type, input.source_id, item.product_id)
      resolvedItems.push({ product_id: item.product_id, qty_return: item.qty_return, restore_hpp: restoreHpp })
    }

    await createReturn(
      {
        id: returnId,
        no_return: noReturn,
        source_type: input.source_type,
        source_id: input.source_id,
        return_date: input.return_date,
        condition: input.condition,
        status: 'processed',
      },
      tx,
    )

    for (const item of resolvedItems) {
      await createReturnItem(
        {
          return_id: returnId,
          product_id: item.product_id,
          qty_return: item.qty_return.toString(),
          restore_hpp: item.restore_hpp,
        },
        tx,
      )

      // Implements PRD §4.2: condition='good' restocks — a brand-new
      // stock_layer at the ORIGINAL restore_hpp (not today's average), so it
      // re-enters FIFO at its true historical cost. condition='damaged'
      // never touches stock_layers/stock_summary — the sale_return_item row
      // itself is the separate record of it (PRD: "catat terpisah").
      if (input.condition === 'good') {
        await createStockLayer(tx, {
          product_id: item.product_id,
          warehouse_id: context.warehouseId,
          source_type: 'sale_return',
          source_id: returnId,
          receive_date: input.return_date,
          qty_original: item.qty_return.toString(),
          qty_remaining: item.qty_return.toString(),
          hpp: item.restore_hpp,
        })

        const value = (item.qty_return * Number(item.restore_hpp)).toString()
        const summary = await upsertStockSummaryOnReceive(tx, {
          product_id: item.product_id,
          warehouse_id: context.warehouseId,
          qty: item.qty_return.toString(),
          value,
        })

        await insertLedgerEntry(tx, {
          product_id: item.product_id,
          warehouse_id: context.warehouseId,
          transaction_type: 'sale_return',
          reference_type: 'sale_return',
          reference_id: returnId,
          reference_no: noReturn,
          transaction_date: new Date(),
          qty_in: item.qty_return.toString(),
          hpp_used: item.restore_hpp,
          running_balance_qty: summary.qty_on_hand,
          running_balance_value: summary.total_value,
        })
      }
    }
  })

  if (input.condition === 'good') {
    const affectedProducts = new Set(input.items.map((i) => i.product_id))
    for (const productId of affectedProducts) {
      await checkAndNotifyStockThreshold(productId, context.warehouseId)
    }
  }

  return getSaleReturnWithItems(returnId)
}

export async function getSaleReturnWithItems(id: string) {
  const ret = await findReturn(id)
  if (!ret) return null
  const items = await listReturnItems(id)
  return { ...ret, items }
}
