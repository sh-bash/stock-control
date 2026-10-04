import { sql } from 'drizzle-orm'
import { db } from '../db/client'

// Aggregations for the procurement pipeline (Request → Comparison → PO →
// Shipment → Receiving) used by the dashboard and the pipeline/shipment
// reports. Plain SQL: these are read-only rollups over small document tables.
// postgres-js returns numerics as strings, so callers Number() what they need.

const rowsOf = <T>(res: unknown) => res as T[]

export async function getPipelineCounts(warehouseId?: string) {
  const poWh = warehouseId ? sql`AND po.warehouse_id = ${warehouseId}` : sql``
  const [requests, comparisons, orders, shipments, receivings] = await Promise.all([
    db.execute(sql`SELECT status, COUNT(*)::int AS count FROM product_requests GROUP BY status`),
    db.execute(sql`SELECT status, COUNT(*)::int AS count FROM product_comparisons GROUP BY status`),
    db.execute(sql`
      SELECT po.status, COUNT(DISTINCT po.id)::int AS count,
             COALESCE(SUM(i.qty_order * i.unit_price), 0) AS value
      FROM purchase_orders po
      LEFT JOIN purchase_order_items i ON i.po_id = po.id
      WHERE 1 = 1 ${poWh}
      GROUP BY po.status`),
    db.execute(sql`SELECT status, COUNT(*)::int AS count FROM shipments GROUP BY status`),
    db.execute(sql`SELECT status, COUNT(*)::int AS count FROM receivings GROUP BY status`),
  ])
  return {
    requests: rowsOf<{ status: string; count: number }>(requests),
    comparisons: rowsOf<{ status: string; count: number }>(comparisons),
    orders: rowsOf<{ status: string; count: number; value: string }>(orders),
    shipments: rowsOf<{ status: string; count: number }>(shipments),
    receivings: rowsOf<{ status: string; count: number }>(receivings),
  }
}

// Value of what is still to arrive on approved POs (ordered − received), in IDR.
export async function getOpenPoValue(warehouseId?: string) {
  const wh = warehouseId ? sql`AND po.warehouse_id = ${warehouseId}` : sql``
  const res = await db.execute(sql`
    SELECT COALESCE(SUM((i.qty_order - i.qty_received) * i.unit_price), 0) AS value,
           COUNT(DISTINCT po.id)::int AS count
    FROM purchase_orders po
    JOIN purchase_order_items i ON i.po_id = po.id
    WHERE po.status IN ('approved', 'partial_received') AND i.qty_order > i.qty_received ${wh}`)
  return rowsOf<{ value: string; count: number }>(res)[0] ?? { value: '0', count: 0 }
}

// PO value (IDR) per month, last N months, excluding drafts/rejected.
export async function getMonthlyPoValue(months: number, warehouseId?: string) {
  const wh = warehouseId ? sql`AND po.warehouse_id = ${warehouseId}` : sql``
  const res = await db.execute(sql`
    SELECT to_char(date_trunc('month', po.order_date::timestamp), 'YYYY-MM') AS month,
           COALESCE(SUM(i.qty_order * i.unit_price), 0) AS value,
           COUNT(DISTINCT po.id)::int AS count
    FROM purchase_orders po
    JOIN purchase_order_items i ON i.po_id = po.id
    WHERE po.status NOT IN ('draft', 'rejected')
      AND po.order_date >= (date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1}))::date
      ${wh}
    GROUP BY 1 ORDER BY 1`)
  return rowsOf<{ month: string; value: string; count: number }>(res)
}

export async function getTopSuppliers(days: number, limit: number, warehouseId?: string) {
  const wh = warehouseId ? sql`AND po.warehouse_id = ${warehouseId}` : sql``
  const res = await db.execute(sql`
    SELECT s.id, s.name, COUNT(DISTINCT po.id)::int AS po_count,
           COALESCE(SUM(i.qty_order * i.unit_price), 0) AS value
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    JOIN purchase_order_items i ON i.po_id = po.id
    WHERE po.status NOT IN ('draft', 'rejected')
      AND po.order_date >= CURRENT_DATE - ${days}::int
      ${wh}
    GROUP BY s.id, s.name ORDER BY value DESC LIMIT ${limit}`)
  return rowsOf<{ id: string; name: string; po_count: number; value: string }>(res)
}

// Shipments still on their way (draft / in transit / arrived but not completed).
export async function getShipmentsInFlight(limit: number) {
  const res = await db.execute(sql`
    SELECT sh.id, sh.no_shipment, sh.status, sh.ship_date, sh.eta_date, sh.tracking_no,
           sh.total_weight, sh.total_shipping_cost, e.name AS expedition_name,
           COALESCE((SELECT SUM(si.qty_shipped) FROM shipment_items si WHERE si.shipment_id = sh.id), 0) AS total_qty,
           (sh.eta_date IS NOT NULL AND sh.eta_date < CURRENT_DATE AND sh.status = 'in_transit') AS overdue
    FROM shipments sh
    JOIN expeditions e ON e.id = sh.expedition_id
    WHERE sh.status IN ('draft', 'in_transit', 'arrived')
    ORDER BY (sh.status = 'in_transit') DESC, sh.eta_date ASC NULLS LAST, sh.ship_date DESC
    LIMIT ${limit}`)
  return rowsOf<any>(res)
}

// ---------------- reports ----------------

export async function listRequestPipeline(filters: { dateFrom?: string; dateTo?: string; status?: string }) {
  const conds = [sql`1 = 1`]
  if (filters.dateFrom) conds.push(sql`r.created_at >= ${filters.dateFrom}::date`)
  if (filters.dateTo) conds.push(sql`r.created_at < (${filters.dateTo}::date + 1)`)
  if (filters.status) conds.push(sql`r.status = ${filters.status}`)
  const where = sql.join(conds, sql` AND `)
  const res = await db.execute(sql`
    SELECT r.id, r.no_request, r.title, r.status, r.needs_approval, r.created_at, u.name AS requested_by_name,
           (SELECT COUNT(*) FROM product_comparisons c WHERE c.request_id = r.id)::int AS comparison_count,
           (SELECT COUNT(*) FROM purchase_orders p WHERE p.request_id = r.id)::int AS po_count,
           (SELECT COALESCE(SUM(i.qty_order * i.unit_price), 0)
              FROM purchase_orders p JOIN purchase_order_items i ON i.po_id = p.id
             WHERE p.request_id = r.id AND p.status NOT IN ('draft', 'rejected')) AS po_value_idr
    FROM product_requests r
    JOIN users u ON u.id = r.requested_by
    WHERE ${where}
    ORDER BY r.created_at DESC`)
  return rowsOf<any>(res)
}

export async function listShipmentReport(filters: { dateFrom?: string; dateTo?: string; expeditionId?: string }) {
  const conds = [sql`1 = 1`]
  if (filters.dateFrom) conds.push(sql`sh.ship_date >= ${filters.dateFrom}::date`)
  if (filters.dateTo) conds.push(sql`sh.ship_date <= ${filters.dateTo}::date`)
  if (filters.expeditionId) conds.push(sql`sh.expedition_id = ${filters.expeditionId}`)
  const where = sql.join(conds, sql` AND `)
  const res = await db.execute(sql`
    SELECT sh.id, sh.no_shipment, sh.status, sh.ship_date, sh.eta_date, sh.tracking_no,
           sh.bl_number, sh.container_no, sh.total_volume,
           sh.total_weight, sh.total_shipping_cost, sh.allocation_method, e.name AS expedition_name,
           COALESCE((SELECT SUM(si.qty_shipped) FROM shipment_items si WHERE si.shipment_id = sh.id), 0) AS total_qty,
           CASE WHEN sh.total_weight IS NOT NULL AND sh.total_weight > 0
                THEN sh.total_shipping_cost / sh.total_weight END AS cost_per_kg
    FROM shipments sh
    JOIN expeditions e ON e.id = sh.expedition_id
    WHERE ${where}
    ORDER BY sh.ship_date DESC`)
  return rowsOf<any>(res)
}
