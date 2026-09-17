import { and, asc, eq, gte, lte, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import {
  stockSummary,
  stockLayers,
  stockLedger,
  movementClassification,
  productMovementStats,
  approvalInstances,
  approvalSteps,
  users,
} from '../db/schema'

// ============================================================
// Stock Value Overview — from stock_summary (materialized), no raw
// aggregation over stock_layers/stock_ledger at request time.
// ============================================================
export function getStockValueOverview(warehouseId?: string) {
  const query = db
    .select({
      total_value: sql<string>`COALESCE(SUM(${stockSummary.total_value}), 0)`,
      total_qty_on_hand: sql<string>`COALESCE(SUM(${stockSummary.qty_on_hand}), 0)`,
      product_count: sql<string>`COUNT(DISTINCT ${stockSummary.product_id})`,
    })
    .from(stockSummary)
  return warehouseId ? query.where(eq(stockSummary.warehouse_id, warehouseId)) : query
}

export function getStockValueByWarehouse() {
  return db
    .select({
      warehouse_id: stockSummary.warehouse_id,
      total_value: sql<string>`COALESCE(SUM(${stockSummary.total_value}), 0)`,
      total_qty_on_hand: sql<string>`COALESCE(SUM(${stockSummary.qty_on_hand}), 0)`,
    })
    .from(stockSummary)
    .groupBy(stockSummary.warehouse_id)
}

// ============================================================
// Aging Summary — per the user's confirmed decision: read stock_layers
// directly (no dedicated materialized aging table exists), but only
// active layers via the Fase 3 composite index
// (product_id, warehouse_id, status, receive_date) — status is part of
// that index, so this is an index-friendly filter, not a full scan.
// Bucketing itself (0-30/31-60/61-90/90+) happens in application code
// since it depends on "today", which SQL can't precompute at rest.
// ============================================================
export function listActiveLayersForAging(warehouseId?: string) {
  const conditions = [eq(stockLayers.status, 'active'), sql`${stockLayers.qty_remaining} > 0`]
  if (warehouseId) conditions.push(eq(stockLayers.warehouse_id, warehouseId))
  return db
    .select({
      product_id: stockLayers.product_id,
      warehouse_id: stockLayers.warehouse_id,
      receive_date: stockLayers.receive_date,
      qty_remaining: stockLayers.qty_remaining,
      hpp: stockLayers.hpp,
    })
    .from(stockLayers)
    .where(and(...conditions))
}

// ============================================================
// Movement Classification Summary — from movement_classification
// (materialized by the Fase 7 job), simple GROUP BY count.
// ============================================================
export function getMovementClassificationCounts(warehouseId?: string) {
  const query = db
    .select({
      classification: movementClassification.classification,
      count: sql<string>`COUNT(*)`,
    })
    .from(movementClassification)
    .groupBy(movementClassification.classification)
  return warehouseId ? query.where(eq(movementClassification.warehouse_id, warehouseId)) : query
}

// ============================================================
// Low Stock Alert — stock_summary is the materialized source; the
// effective-settings resolution (Fase 5's resolveEffectiveSettings) is a
// cheap per-row lookup, not a raw aggregation, so this stays within the
// spirit of the constraint.
// ============================================================
export function listStockSummaryForLowStockCheck(warehouseId?: string) {
  const query = db.select().from(stockSummary)
  return warehouseId ? query.where(eq(stockSummary.warehouse_id, warehouseId)) : query
}

// ============================================================
// Purchase vs Sale Trend — per the user's confirmed decision: read
// stock_ledger directly (no dedicated daily-trend materialized table
// exists), filtered on transaction_date (part of the Fase 3 composite
// index) and grouped by day.
// ============================================================
export function getPurchaseSaleTrend(filters: { dateFrom: string; dateTo: string; warehouseId?: string }) {
  const conditions = [
    gte(stockLedger.transaction_date, new Date(filters.dateFrom)),
    lte(stockLedger.transaction_date, new Date(`${filters.dateTo}T23:59:59.999Z`)),
  ]
  if (filters.warehouseId) conditions.push(eq(stockLedger.warehouse_id, filters.warehouseId))

  return db
    .select({
      day: sql<string>`DATE(${stockLedger.transaction_date})`,
      purchase_qty: sql<string>`COALESCE(SUM(CASE WHEN ${stockLedger.transaction_type} = 'receiving' THEN ${stockLedger.qty_in} ELSE 0 END), 0)`,
      purchase_value: sql<string>`COALESCE(SUM(CASE WHEN ${stockLedger.transaction_type} = 'receiving' THEN ${stockLedger.qty_in} * ${stockLedger.hpp_used} ELSE 0 END), 0)`,
      sale_qty: sql<string>`COALESCE(SUM(CASE WHEN ${stockLedger.transaction_type} = 'delivery' THEN ${stockLedger.qty_out} ELSE 0 END), 0)`,
      sale_value: sql<string>`COALESCE(SUM(CASE WHEN ${stockLedger.transaction_type} = 'delivery' THEN ${stockLedger.qty_out} * ${stockLedger.hpp_used} ELSE 0 END), 0)`,
    })
    .from(stockLedger)
    .where(and(...conditions))
    .groupBy(sql`DATE(${stockLedger.transaction_date})`)
    .orderBy(sql`DATE(${stockLedger.transaction_date})`)
}

// ============================================================
// Pending Approval widget — approval_instances is itself a small live
// state table (not a transactional ledger), so querying it directly for
// "what's pending for me" is inherent to the feature, not a heavy
// aggregation.
// ============================================================
export async function listPendingApprovalsForUser(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return []

  return db
    .select({
      id: approvalInstances.id,
      workflow_id: approvalInstances.workflow_id,
      document_type: approvalInstances.document_type,
      document_id: approvalInstances.document_id,
      current_step: approvalInstances.current_step,
      status: approvalInstances.status,
      created_at: approvalInstances.created_at,
    })
    .from(approvalInstances)
    .innerJoin(
      approvalSteps,
      and(
        eq(approvalSteps.workflow_id, approvalInstances.workflow_id),
        eq(approvalSteps.step_order, approvalInstances.current_step),
      ),
    )
    .where(
      and(
        eq(approvalInstances.status, 'pending'),
        or(
          and(eq(approvalSteps.approver_type, 'user'), eq(approvalSteps.approver_id, userId)),
          and(eq(approvalSteps.approver_type, 'role'), eq(approvalSteps.approver_id, user.role_id)),
        ),
      ),
    )
    .orderBy(asc(approvalInstances.created_at))
}

// ============================================================
// Stock Aging & Projection detail page — combines stock_summary (qty),
// stock_layers (oldest active layer's age, via the composite index),
// product_movement_stats (avg_daily_out_qty_30d), and
// movement_classification, all materialized/indexed sources.
// ============================================================
export function listStockSummaryWithWarehouse(warehouseId?: string) {
  const query = db.select().from(stockSummary)
  return warehouseId ? query.where(eq(stockSummary.warehouse_id, warehouseId)) : query
}

export function findOldestActiveLayer(productId: string, warehouseId: string) {
  return db
    .select({ receive_date: stockLayers.receive_date })
    .from(stockLayers)
    .where(
      and(
        eq(stockLayers.product_id, productId),
        eq(stockLayers.warehouse_id, warehouseId),
        eq(stockLayers.status, 'active'),
        sql`${stockLayers.qty_remaining} > 0`,
      ),
    )
    .orderBy(asc(stockLayers.receive_date))
    .limit(1)
}

export function findMovementStats(productId: string, warehouseId: string) {
  return db.query.productMovementStats.findFirst({
    where: and(eq(productMovementStats.product_id, productId), eq(productMovementStats.warehouse_id, warehouseId)),
  })
}

export function findClassification(productId: string, warehouseId: string) {
  return db.query.movementClassification.findFirst({
    where: and(eq(movementClassification.product_id, productId), eq(movementClassification.warehouse_id, warehouseId)),
  })
}
