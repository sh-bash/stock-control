import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import {
  products,
  warehouses,
  stockSummary,
  stockLedger,
  stockLayers,
  stockImportBatches,
  stockImportRows,
} from '../db/schema'
import { createStockLayer, insertLedgerEntry, upsertStockSummaryOnReceive } from '../repositories/stock.repository'
import { checkAndNotifyStockThreshold, consumeStock } from './stock.service'
import { failure } from '../utils/response'
import { genDocNo } from '../utils/doc-no'

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export type ImportAction = 'opening_balance' | 'adjust_in' | 'adjust_out' | 'unchanged'

export interface ImportRow {
  row_no: number
  sku: string
  warehouse: string
  qty: number | null
  hpp: number | null
}

export interface PlannedRow extends ImportRow {
  product_id: string | null
  product_name: string | null
  warehouse_id: string | null
  warehouse_name: string | null
  qty_before: number
  qty_diff: number
  hpp_used: number | null
  action: ImportAction | null
  error: string | null
}

// ---------- file parsing ----------

const HEADER_ALIASES: Record<string, 'sku' | 'warehouse' | 'qty' | 'hpp'> = {
  sku: 'sku',
  kode: 'sku',
  kode_produk: 'sku',
  product_sku: 'sku',
  warehouse: 'warehouse',
  gudang: 'warehouse',
  kode_gudang: 'warehouse',
  warehouse_code: 'warehouse',
  qty: 'qty',
  quantity: 'qty',
  stok: 'qty',
  stock: 'qty',
  jumlah: 'qty',
  hpp: 'hpp',
  cost: 'hpp',
  harga_pokok: 'hpp',
  harga: 'hpp',
}

const normKey = (k: string) => k.trim().toLowerCase().replace(/[\s-]+/g, '_')

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  // Accept "1.234,56" (id-ID) as well as "1234.56".
  const s = String(v).trim().replace(/\s/g, '')
  const normalized = /,\d{1,4}$/.test(s) && s.includes('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

// Maps whatever header spelling the sheet uses onto sku/warehouse/qty/hpp and
// drops fully blank lines. Pure so it can be unit tested without a file.
export function normalizeRows(raw: Record<string, unknown>[]): ImportRow[] {
  const rows: ImportRow[] = []
  raw.forEach((r, i) => {
    const m: Partial<Record<'sku' | 'warehouse' | 'qty' | 'hpp', unknown>> = {}
    for (const [k, v] of Object.entries(r)) {
      const field = HEADER_ALIASES[normKey(k)]
      if (field && m[field] === undefined) m[field] = v
    }
    const sku = String(m.sku ?? '').trim()
    const warehouse = String(m.warehouse ?? '').trim()
    if (!sku && !warehouse && (m.qty == null || m.qty === '')) return
    rows.push({ row_no: i + 2, sku, warehouse, qty: toNumber(m.qty), hpp: toNumber(m.hpp) })
  })
  return rows
}

// The Excel/CSV file is parsed in the browser (Import Stock page) and arrives
// here as plain row objects keyed by the sheet's header row — so the server
// never bundles a spreadsheet library.
export function rowsFromRaw(raw: Record<string, unknown>[]): ImportRow[] {
  const rows = normalizeRows(raw)
  if (rows.length === 0) {
    return failure('Tidak ada baris data. Kolom yang dibutuhkan: sku, warehouse, qty, hpp', 'EMPTY_FILE', 400)
  }
  return rows
}

// ---------- planning ----------

// Decides what an import row means for a product+warehouse:
//  - nothing was ever recorded there and qty > 0     → saldo awal (opening balance)
//  - imported qty differs from what the system holds → selisih: saldo in / minus
//  - same                                            → no change
export function decideAction(p: { qtyBefore: number; hasHistory: boolean; qtyImport: number }): ImportAction {
  const diff = p.qtyImport - p.qtyBefore
  if (Math.abs(diff) < 0.00005) return 'unchanged'
  if (p.qtyBefore === 0 && !p.hasHistory) return 'opening_balance'
  return diff > 0 ? 'adjust_in' : 'adjust_out'
}

export async function buildImportPlan(rows: ImportRow[], executor: Executor = db): Promise<PlannedRow[]> {
  const skus = [...new Set(rows.map((r) => r.sku).filter(Boolean))]
  const whKeys = [...new Set(rows.map((r) => r.warehouse).filter(Boolean))]

  const productRows = skus.length ? await executor.select().from(products).where(inArray(products.sku, skus)) : []
  const whRows = whKeys.length
    ? await executor.select().from(warehouses).where(or(inArray(warehouses.code, whKeys), inArray(warehouses.name, whKeys)))
    : []
  const productBySku = new Map(productRows.map((p) => [p.sku, p]))
  const whByKey = new Map<string, (typeof whRows)[number]>()
  for (const w of whRows) {
    whByKey.set(w.code, w)
    if (!whByKey.has(w.name)) whByKey.set(w.name, w)
  }

  const productIds = productRows.map((p) => p.id)
  const summaries = productIds.length
    ? await executor.select().from(stockSummary).where(inArray(stockSummary.product_id, productIds))
    : []
  const summaryOf = new Map(summaries.map((s) => [`${s.product_id}:${s.warehouse_id}`, s]))

  const historyRows = productIds.length
    ? await executor
        .selectDistinct({ product_id: stockLayers.product_id, warehouse_id: stockLayers.warehouse_id })
        .from(stockLayers)
        .where(inArray(stockLayers.product_id, productIds))
    : []
  const ledgerRows = productIds.length
    ? await executor
        .selectDistinct({ product_id: stockLedger.product_id, warehouse_id: stockLedger.warehouse_id })
        .from(stockLedger)
        .where(inArray(stockLedger.product_id, productIds))
    : []
  const hasHistory = new Set([...historyRows, ...ledgerRows].map((h) => `${h.product_id}:${h.warehouse_id}`))

  const seen = new Set<string>()

  return rows.map((r): PlannedRow => {
    const base: PlannedRow = {
      ...r,
      product_id: null,
      product_name: null,
      warehouse_id: null,
      warehouse_name: null,
      qty_before: 0,
      qty_diff: 0,
      hpp_used: null,
      action: null,
      error: null,
    }
    const product = productBySku.get(r.sku)
    const wh = whByKey.get(r.warehouse)
    if (!r.sku) return { ...base, error: 'SKU kosong' }
    if (!product) return { ...base, error: `SKU "${r.sku}" tidak ditemukan di master product` }
    base.product_id = product.id
    base.product_name = product.name
    if (!wh) return { ...base, error: `Gudang "${r.warehouse}" tidak ditemukan` }
    base.warehouse_id = wh.id
    base.warehouse_name = wh.name
    if (r.qty == null) return { ...base, error: 'Qty kosong atau bukan angka' }
    if (r.qty < 0) return { ...base, error: 'Qty tidak boleh negatif' }
    if (r.hpp != null && r.hpp < 0) return { ...base, error: 'HPP tidak boleh negatif' }

    const key = `${product.id}:${wh.id}`
    if (seen.has(key)) return { ...base, error: 'Duplikat: SKU + gudang yang sama muncul lebih dari sekali' }
    seen.add(key)

    const summary = summaryOf.get(key)
    const qtyBefore = Number(summary?.qty_on_hand ?? 0)
    const action = decideAction({ qtyBefore, hasHistory: hasHistory.has(key), qtyImport: r.qty })

    // HPP for stock coming IN: the file's value, else the current average cost.
    let hppUsed: number | null = r.hpp
    if (hppUsed == null && action === 'adjust_in' && qtyBefore > 0) {
      hppUsed = Number(summary!.total_value) / qtyBefore
    }
    if ((action === 'opening_balance' || action === 'adjust_in') && hppUsed == null) {
      return {
        ...base,
        qty_before: qtyBefore,
        qty_diff: r.qty - qtyBefore,
        action,
        error: 'HPP wajib diisi untuk saldo awal / penambahan stok',
      }
    }

    return { ...base, qty_before: qtyBefore, qty_diff: r.qty - qtyBefore, hpp_used: hppUsed, action }
  })
}

export function summarizePlan(plan: PlannedRow[]) {
  const count = (a: ImportAction) => plan.filter((p) => !p.error && p.action === a).length
  return {
    total_rows: plan.length,
    error_rows: plan.filter((p) => p.error).length,
    opening_rows: count('opening_balance'),
    adjust_in_rows: count('adjust_in'),
    adjust_out_rows: count('adjust_out'),
    unchanged_rows: count('unchanged'),
  }
}

export async function previewStockImport(rows: ImportRow[]) {
  const plan = await buildImportPlan(rows)
  return { summary: summarizePlan(plan), rows: plan }
}

// ---------- commit ----------

export async function commitStockImport(input: {
  rows: ImportRow[]
  file_name?: string | null
  import_date: string
  user_id: string
}) {
  const result = await db.transaction(async (tx) => {
    // Re-plan inside the transaction so qty_before reflects the live balance,
    // not whatever the preview saw minutes ago.
    const plan = await buildImportPlan(input.rows, tx)
    const summary = summarizePlan(plan)
    if (summary.error_rows > 0) {
      return failure(`Import dibatalkan: ${summary.error_rows} baris bermasalah. Perbaiki file lalu coba lagi.`, 'IMPORT_HAS_ERRORS', 400)
    }

    const [batch] = await tx
      .insert(stockImportBatches)
      .values({
        no_batch: genDocNo('IMP'),
        file_name: input.file_name ?? null,
        import_date: input.import_date,
        total_rows: summary.total_rows,
        opening_rows: summary.opening_rows,
        adjust_in_rows: summary.adjust_in_rows,
        adjust_out_rows: summary.adjust_out_rows,
        unchanged_rows: summary.unchanged_rows,
        created_by: input.user_id,
      })
      .returning()

    for (const p of plan) {
      const productId = p.product_id!
      const warehouseId = p.warehouse_id!

      if (p.action === 'opening_balance' || p.action === 'adjust_in') {
        const qty = p.qty_diff
        const hpp = p.hpp_used!
        await createStockLayer(tx, {
          product_id: productId,
          warehouse_id: warehouseId,
          source_type: 'import',
          source_id: batch.id,
          receive_date: input.import_date,
          qty_original: qty.toString(),
          qty_remaining: qty.toString(),
          hpp: hpp.toString(),
        })
        const summaryRow = await upsertStockSummaryOnReceive(tx, {
          product_id: productId,
          warehouse_id: warehouseId,
          qty: qty.toString(),
          value: (qty * hpp).toString(),
        })
        await insertLedgerEntry(tx, {
          product_id: productId,
          warehouse_id: warehouseId,
          transaction_type: p.action === 'opening_balance' ? 'opening_balance' : 'import_adjust_in',
          reference_type: 'stock_import',
          reference_id: batch.id,
          reference_no: batch.no_batch,
          transaction_date: new Date(),
          qty_in: qty.toString(),
          hpp_used: hpp.toString(),
          running_balance_qty: summaryRow!.qty_on_hand,
          running_balance_value: summaryRow!.total_value,
        })
      } else if (p.action === 'adjust_out') {
        await consumeStock(tx, {
          product_id: productId,
          warehouse_id: warehouseId,
          qty_needed: Math.abs(p.qty_diff),
          transaction_type: 'import_adjust_out',
          reference_type: 'stock_import',
          reference_id: batch.id,
          reference_no: batch.no_batch,
        })
      }

      await tx.insert(stockImportRows).values({
        batch_id: batch.id,
        product_id: productId,
        warehouse_id: warehouseId,
        qty_before: p.qty_before.toString(),
        qty_import: String(p.qty),
        qty_diff: p.qty_diff.toString(),
        hpp: p.hpp_used?.toString() ?? null,
        action: p.action!,
      })
    }

    return { batch, summary, plan }
  })

  // Threshold alerts run after commit, like every other stock mutation.
  for (const p of result.plan) {
    if (p.action === 'adjust_out') await checkAndNotifyStockThreshold(p.product_id!, p.warehouse_id!)
  }

  return { batch: result.batch, summary: result.summary }
}

export function listImportBatches() {
  return db.select().from(stockImportBatches).orderBy(sql`${stockImportBatches.created_at} DESC`).limit(100)
}

export async function getImportBatch(id: string) {
  const batch = await db.query.stockImportBatches.findFirst({ where: eq(stockImportBatches.id, id) })
  if (!batch) return null
  const rows = await db.select().from(stockImportRows).where(and(eq(stockImportRows.batch_id, id)))
  return { ...batch, rows }
}
