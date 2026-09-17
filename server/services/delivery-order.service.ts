import { randomUUID } from 'node:crypto'
import { db } from '../db/client'
import {
  createOrder,
  createItem,
  findOrder,
  getOrderForUpdate,
  listItems,
  setItemCogsTx,
  updateOrderTx,
} from '../repositories/delivery-order.repository'
import {
  findOrder as findSaleOrder,
  findItem as findSoItem,
  incrementQtyDelivered,
} from '../repositories/sale-order.repository'
import { decrementReservedQtyGuarded } from '../repositories/stock.repository'
import { consumeStock, checkAndNotifyStockThreshold } from './stock.service'
import { recalculateSaleOrderStatus } from './sale-order.service'
import { failure } from '../utils/response'

export interface CreateDoItemInput {
  so_item_id: string
  product_id: string
  qty_delivered: number
}

export async function createDeliveryOrderWithItems(input: {
  so_id: string
  warehouse_id: string
  delivery_date: string
  items: CreateDoItemInput[]
}) {
  if (input.items.length === 0) {
    return failure('DO harus punya minimal 1 item', 'EMPTY_ITEMS', 400)
  }

  const so = await findSaleOrder(input.so_id)
  if (!so) return failure('SO tidak ditemukan', 'NOT_FOUND', 404)
  if (!so.use_do) {
    return failure('SO ini tidak menggunakan DO (use_do=false)', 'DO_NOT_APPLICABLE', 400)
  }
  if (so.status !== 'confirmed' && so.status !== 'partial_delivered') {
    return failure(`DO tidak bisa dibuat untuk SO berstatus "${so.status}"`, 'INVALID_SO_STATUS', 400)
  }

  for (const item of input.items) {
    const soItem = await findSoItem(item.so_item_id)
    if (!soItem || soItem.so_id !== input.so_id) {
      return failure('so_item_id tidak ditemukan pada SO ini', 'NOT_FOUND', 404)
    }
    const remaining = Number(soItem.qty_order) - Number(soItem.qty_delivered)
    if (item.qty_delivered > remaining) {
      return failure(
        `qty_delivered (${item.qty_delivered}) melebihi sisa qty yang belum dikirim (${remaining})`,
        'EXCEEDS_REMAINING_QTY',
        400,
      )
    }
  }

  const noDo = `DO-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

  const [deliveryOrder] = await createOrder({
    no_do: noDo,
    so_id: input.so_id,
    warehouse_id: input.warehouse_id,
    delivery_date: input.delivery_date,
    status: 'draft',
  })

  const items = []
  for (const item of input.items) {
    const [row] = await createItem({
      do_id: deliveryOrder.id,
      so_item_id: item.so_item_id,
      product_id: item.product_id,
      qty_delivered: item.qty_delivered.toString(),
    })
    items.push(row)
  }

  return { ...deliveryOrder, items }
}

export async function getDeliveryOrderWithItems(id: string) {
  const deliveryOrder = await findOrder(id)
  if (!deliveryOrder) return null
  const items = await listItems(id)
  return { ...deliveryOrder, items }
}

// Implements PRD §6.4's "ON delivery_order.status -> 'approved'" — direct
// action (no generic approval workflow for SO/DO per Fase 6 scope). Runs
// consumeStock (§6.1) per item, records cogs_per_unit on the DO item,
// releases the SO's reservation, and accumulates sale_order_items.qty_delivered
// — all inside ONE transaction.
//
// The status check happens AFTER locking the DO row (FOR UPDATE) inside the
// transaction, not before opening it — see the identical fix and rationale
// on confirmSaleOrder in sale-order.service.ts. Without the lock, two
// concurrent approve requests for the same DO could both read
// status='draft' and both run consumeStock, physically shipping the same
// delivery twice.
export async function approveDeliveryOrder(doId: string) {
  const items = await listItems(doId)

  const deliveryOrder = await db.transaction(async (tx) => {
    const lockedDo = await getOrderForUpdate(tx, doId)
    if (!lockedDo) return failure('DO tidak ditemukan', 'NOT_FOUND', 404)
    if (lockedDo.status !== 'draft') {
      return failure(`DO tidak bisa di-approve dari status "${lockedDo.status}"`, 'INVALID_STATUS', 400)
    }

    for (const item of items) {
      const cogsPerUnit = await consumeStock(tx, {
        product_id: item.product_id,
        warehouse_id: lockedDo.warehouse_id,
        qty_needed: Number(item.qty_delivered),
        transaction_type: 'delivery',
        reference_type: 'do',
        reference_id: lockedDo.id,
        reference_no: lockedDo.no_do,
      })

      await setItemCogsTx(tx, item.id, cogsPerUnit.toString())

      await decrementReservedQtyGuarded(tx, {
        product_id: item.product_id,
        warehouse_id: lockedDo.warehouse_id,
        qty: item.qty_delivered,
      })

      await incrementQtyDelivered(tx, item.so_item_id, Number(item.qty_delivered))
    }

    await updateOrderTx(tx, doId, { status: 'approved' })

    return lockedDo
  })

  await recalculateSaleOrderStatus(deliveryOrder.so_id)

  const affectedProducts = new Set(items.map((i) => i.product_id))
  for (const productId of affectedProducts) {
    await checkAndNotifyStockThreshold(productId, deliveryOrder.warehouse_id)
  }

  return getDeliveryOrderWithItems(doId)
}
