import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import {
  createOrder,
  createItem,
  findOrder,
  getOrderForUpdate,
  listItems,
  updateOrder,
  updateOrderTx,
  incrementQtyDelivered,
} from '../repositories/sale-order.repository'
import { incrementReservedQty } from '../repositories/stock.repository'
import { consumeStock, checkAndNotifyStockThreshold } from './stock.service'
import { failure } from '../utils/response'

export interface CreateSoItemInput {
  product_id: string
  qty_order: number
  sell_price: number
}

export async function createSaleOrder(input: {
  customer_id: string
  warehouse_id: string
  order_date: string
  use_do: boolean
  created_by: string
  items: CreateSoItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('SO harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }

  const noSo = `SO-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  const [so] = await createOrder({
    no_so: noSo,
    customer_id: input.customer_id,
    warehouse_id: input.warehouse_id,
    order_date: input.order_date,
    use_do: input.use_do,
    created_by: input.created_by,
    status: 'draft',
  })

  const items = []
  for (const item of input.items) {
    const [row] = await createItem({
      so_id: so.id,
      product_id: item.product_id,
      qty_order: item.qty_order.toString(),
      sell_price: item.sell_price.toString(),
    })
    items.push(row)
  }

  return { ...so, items }
}

export async function getSaleOrderWithItems(id: string) {
  const so = await findOrder(id)
  if (!so) return null
  const items = await listItems(id)
  return { ...so, items }
}

// Implements PRD §6.4. use_do=false: consumeStock (§6.1 FIFO) for every
// item immediately and close the SO in the same transaction. use_do=true:
// only reserve the qty (qty_reserved += qty_order) — physical consumption
// is deferred to when a delivery order against this SO is approved.
//
// The status check is done AFTER locking the SO row (FOR UPDATE) inside the
// transaction, not before opening it. Checking first and writing later left
// a race window: two concurrent confirm requests for the same SO (a
// double-click, a client retry) could both read status='draft', both pass
// the check, and both run consumeStock — physically consuming stock twice
// for one order. Locking first serializes them: the second request blocks
// until the first commits, then re-reads status as 'closed'/'confirmed'
// and cleanly rejects instead of double-consuming.
export async function confirmSaleOrder(soId: string) {
  const items = await listItems(soId)

  const useDo = await db.transaction(async (tx) => {
    const so = await getOrderForUpdate(tx, soId)
    if (!so) return failure('SO tidak ditemukan', 'NOT_FOUND', 404)
    if (so.status !== 'draft') {
      return failure(`SO tidak bisa di-confirm dari status "${so.status}"`, 'INVALID_STATUS', 400)
    }

    if (!so.use_do) {
      for (const item of items) {
        await consumeStock(tx, {
          product_id: item.product_id,
          warehouse_id: so.warehouse_id,
          qty_needed: Number(item.qty_order),
          transaction_type: 'delivery',
          reference_type: 'so',
          reference_id: so.id,
          reference_no: so.no_so,
        })
        // qty_delivered mirrors qty_order for the direct-consume path — the
        // whole item was fulfilled in the same step that confirmed the SO.
        await incrementQtyDelivered(tx, item.id, Number(item.qty_order))
      }
      await updateOrderTx(tx, soId, { status: 'closed' })
    } else {
      for (const item of items) {
        await incrementReservedQty(tx, {
          product_id: item.product_id,
          warehouse_id: so.warehouse_id,
          qty: item.qty_order,
        })
      }
      await updateOrderTx(tx, soId, { status: 'confirmed' })
    }

    return so.use_do
  })

  if (!useDo) {
    const so = await findOrder(soId)
    const affectedProducts = new Set(items.map((i) => i.product_id))
    for (const productId of affectedProducts) {
      await checkAndNotifyStockThreshold(productId, so!.warehouse_id)
    }
  }

  return getSaleOrderWithItems(soId)
}

// Mirrors recalculatePurchaseOrderStatus: derives partial_delivered/closed
// from accumulated qty_delivered vs qty_order across items, called after a
// delivery order against this SO is approved.
export async function recalculateSaleOrderStatus(soId: string) {
  const so = await findOrder(soId)
  if (!so) return
  if (so.status !== 'confirmed' && so.status !== 'partial_delivered') return

  const items = await listItems(soId)
  const totalOrdered = items.reduce((sum, i) => sum + Number(i.qty_order), 0)
  const totalDelivered = items.reduce((sum, i) => sum + Number(i.qty_delivered), 0)

  let newStatus = so.status
  if (totalDelivered >= totalOrdered && totalOrdered > 0) {
    newStatus = 'closed'
  } else if (totalDelivered > 0) {
    newStatus = 'partial_delivered'
  }

  if (newStatus !== so.status) {
    await updateOrder(soId, { status: newStatus })
  }
}
