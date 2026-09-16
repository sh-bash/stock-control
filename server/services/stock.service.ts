import { and, eq, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db/client'
import { products, stockLayers, stockSummary, warehouses } from '../db/schema'
import { resolveEffectiveSettings } from '../repositories/product-stock-settings.repository'
import {
  consumeLayersFifo,
  decrementStockSummaryGuarded,
  insertLedgerEntry,
} from '../repositories/stock.repository'
import { createNotification } from './notification.service'

interface LayerAggregate {
  product_id: string
  warehouse_id: string
  qty_on_hand: string
  total_value: string
}

// Recomputes stock_summary.qty_on_hand / total_value from the ground truth
// (SUM of qty_remaining / qty_remaining*hpp across stock_layers), for every
// product+warehouse combination that has layers and/or an existing summary
// row. qty_reserved is left untouched — it's driven by sale-order
// reservations (Fase 6), not by the layer ledger. Runs in one transaction
// with FOR UPDATE on every touched stock_summary row so it can't race a
// live receiving/return/transfer/adjustment mid-rebuild.
export async function rebuildStockSummary() {
  const aggregates = await db
    .select({
      product_id: stockLayers.product_id,
      warehouse_id: stockLayers.warehouse_id,
      qty_on_hand: sql<string>`COALESCE(SUM(${stockLayers.qty_remaining}), 0)`,
      total_value: sql<string>`COALESCE(SUM(${stockLayers.qty_remaining} * ${stockLayers.hpp}), 0)`,
    })
    .from(stockLayers)
    .groupBy(stockLayers.product_id, stockLayers.warehouse_id)

  const aggregateKey = (a: { product_id: string; warehouse_id: string }) => `${a.product_id}:${a.warehouse_id}`
  const aggregateMap = new Map<string, LayerAggregate>(aggregates.map((a) => [aggregateKey(a), a]))

  const existingSummaries = await db.select().from(stockSummary)

  // Any existing summary row for a combination that no longer has any
  // layers (fully returned/transferred/adjusted away) must be reconciled
  // to zero rather than left stale.
  for (const existing of existingSummaries) {
    const key = `${existing.product_id}:${existing.warehouse_id}`
    if (!aggregateMap.has(key)) {
      aggregateMap.set(key, {
        product_id: existing.product_id,
        warehouse_id: existing.warehouse_id,
        qty_on_hand: '0',
        total_value: '0',
      })
    }
  }

  const results: { product_id: string; warehouse_id: string; before: string | null; after: string }[] = []

  await db.transaction(async (tx) => {
    for (const agg of aggregateMap.values()) {
      const existing = existingSummaries.find(
        (s) => s.product_id === agg.product_id && s.warehouse_id === agg.warehouse_id,
      )
      const qtyReserved = existing?.qty_reserved ?? '0'
      const qtyAvailable = (Number(agg.qty_on_hand) - Number(qtyReserved)).toString()

      const rows = await tx
        .insert(stockSummary)
        .values({
          product_id: agg.product_id,
          warehouse_id: agg.warehouse_id,
          qty_on_hand: agg.qty_on_hand,
          qty_reserved: qtyReserved,
          qty_available: qtyAvailable,
          total_value: agg.total_value,
        })
        .onConflictDoUpdate({
          target: [stockSummary.product_id, stockSummary.warehouse_id],
          set: {
            qty_on_hand: agg.qty_on_hand,
            qty_available: qtyAvailable,
            total_value: agg.total_value,
            updated_at: new Date(),
          },
        })
        .returning()

      results.push({
        product_id: agg.product_id,
        warehouse_id: agg.warehouse_id,
        before: existing?.qty_on_hand ?? null,
        after: rows[0].qty_on_hand,
      })
    }
  })

  return results
}

// Implements PRD §6.1 consumeStock — the CORE FIFO consumption function
// shared by every stock-out path that doesn't target a specific layer (sale
// order without DO, delivery order, and — from Fase 4 — negative stock
// adjustments via consumeLayersFifo directly). Takes the caller's
// transaction so the layer decrements, stock_summary decrement and ledger
// entry commit atomically together with whatever document status change
// triggered it. Returns cogs_per_unit = weighted-average cost of the layers
// actually consumed, exactly as §6.1 specifies (total_cogs / qty_needed).
export async function consumeStock(
  tx: PgTransaction<any, any, any>,
  params: {
    product_id: string
    warehouse_id: string
    qty_needed: number
    transaction_type: string
    reference_type: string
    reference_id: string
    reference_no?: string | null
    transaction_date?: Date
  },
): Promise<number> {
  const consumption = await consumeLayersFifo(tx, params.product_id, params.warehouse_id, params.qty_needed)
  const cogsPerUnit = consumption.totalCost / params.qty_needed

  const summary = await decrementStockSummaryGuarded(tx, {
    product_id: params.product_id,
    warehouse_id: params.warehouse_id,
    qty: params.qty_needed.toString(),
    value: consumption.totalCost.toString(),
  })

  await insertLedgerEntry(tx, {
    product_id: params.product_id,
    warehouse_id: params.warehouse_id,
    transaction_type: params.transaction_type,
    reference_type: params.reference_type,
    reference_id: params.reference_id,
    reference_no: params.reference_no ?? null,
    transaction_date: params.transaction_date ?? new Date(),
    qty_out: params.qty_needed.toString(),
    hpp_used: cogsPerUnit.toString(),
    running_balance_qty: summary.qty_on_hand,
    running_balance_value: summary.total_value,
  })

  return cogsPerUnit
}

// Implements PRD §6.7's "ON stock_summary updated" trigger: resolve the
// effective min_stock/reorder_point for this product+warehouse (per-field
// fallback: specific override -> product-level override -> global — see
// resolveEffectiveSettings) and fire a notification if qty_on_hand has
// crossed either threshold. min_stock (danger) takes priority over
// reorder_point (warning) when both are breached. Called after every stock
// mutation (receiving, purchase return, transfer, adjustment) commits, for
// each product+warehouse it touched — never from inside the mutation's own
// transaction, so a notification is only ever sent for state that's
// actually landed.
export async function checkAndNotifyStockThreshold(productId: string, warehouseId: string) {
  const [summary] = await db
    .select()
    .from(stockSummary)
    .where(and(eq(stockSummary.product_id, productId), eq(stockSummary.warehouse_id, warehouseId)))

  if (!summary) return

  const settings = await resolveEffectiveSettings(productId, warehouseId)
  if (!settings) return

  const qtyOnHand = Number(summary.qty_on_hand)

  let type: 'min_stock' | 'reorder_point' | null = null
  let severity: 'danger' | 'warning' | null = null
  let thresholdLabel = ''
  let thresholdValue = ''

  if (settings.min_stock != null && qtyOnHand <= Number(settings.min_stock)) {
    type = 'min_stock'
    severity = 'danger'
    thresholdLabel = 'batas minimum'
    thresholdValue = settings.min_stock
  } else if (settings.reorder_point != null && qtyOnHand <= Number(settings.reorder_point)) {
    type = 'reorder_point'
    severity = 'warning'
    thresholdLabel = 'reorder point'
    thresholdValue = settings.reorder_point
  }

  if (!type || !severity) return

  const [product] = await db.select().from(products).where(eq(products.id, productId))
  const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId))

  await createNotification({
    type,
    severity,
    title: `Stock ${product?.name ?? productId} mencapai ${thresholdLabel}`,
    message: `Stock ${product?.sku ?? productId} di gudang ${warehouse?.name ?? warehouseId} tersisa ${qtyOnHand} (${thresholdLabel}: ${thresholdValue}).`,
    reference_type: 'stock_summary',
    reference_id: summary.id,
    product_id: productId,
    warehouse_id: warehouseId,
  })
}
