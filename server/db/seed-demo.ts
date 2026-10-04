// Demo data seeder: `npm run db:seed:demo` (run `npm run db:seed` first).
// Master data is inserted directly; every transaction is driven through the
// real services (PO -> shipment -> receiving -> SO/DO -> returns/transfers/
// adjustments) so FIFO layers, stock_ledger and stock_summary stay
// consistent. Documents are then back-dated so lists/reports/date filters
// have ~6 months of history. Pass --force to seed even if products exist.
import 'dotenv/config'
import { createError } from 'h3'
import bcrypt from 'bcryptjs'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from './client'
import * as s from './schema'
import { createPurchaseOrder, submitPurchaseOrder, approvePurchaseOrder, rejectPurchaseOrder } from '../services/purchase-order.service'
import { createShipmentWithItems } from '../services/shipment.service'
import { createReceivingWithItems, submitReceiving, approveReceiving, rejectReceiving } from '../services/receiving.service'
import { createPurchaseReturnWithItems, submitPurchaseReturn, approvePurchaseReturn } from '../services/purchase-return.service'
import { createProductRequest, submitProductRequest, approveProductRequest } from '../services/product-request.service'
import { createProductComparison, addCandidate, setCandidateSelected, promoteCandidates } from '../services/product-comparison.service'
import { addComment } from '../services/comment.service'
import { createAndExecuteTransfer } from '../services/stock-transfer.service'
import { createAdjustmentWithItems, submitAdjustment, approveAdjustment, rejectAdjustment } from '../services/stock-adjustment.service'
import { runMovementClassificationJob } from '../jobs/movement-classification.job'
import { runStockValuationSnapshotJob } from '../jobs/stock-valuation-snapshot.job'
import { runAgingCheckJob } from '../jobs/aging-check.job'

;(globalThis as any).createError = createError

// ---------- deterministic RNG so reruns look alike ----------
let seed = 20260919
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const chance = (p: number) => rnd() < p
const shuffle = <T>(arr: T[]) => [...arr].sort(() => rnd() - 0.5)
const dstr = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
const stamp = (d: Date) => new Date(`${dstr(d)}T${String(int(8, 16)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`)

const stats: Record<string, number> = {}
const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1)
const failed: Record<string, number> = {}

async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn()
    bump(label)
    return r
  } catch (e: any) {
    const code = e?.data?.meta?.code ?? e?.message ?? 'ERR'
    const k = `${label}:${code}`
    failed[k] = (failed[k] ?? 0) + 1
    return null
  }
}

// Shift every trace of a document (ledger rows, layers it created, approval
// instance) to the given business date.
async function backdate(id: string, table: string, date: Date) {
  const tsd = stamp(date)
  const ts = tsd.toISOString().replace('T', ' ').replace('Z', '')
  const day = dstr(date)
  await db.execute(sql`UPDATE stock_ledger SET transaction_date = ${ts}, created_at = ${ts}, updated_at = ${ts} WHERE reference_id = ${id}`)
  await db.execute(sql`UPDATE stock_layers SET receive_date = ${day}, created_at = ${ts}, updated_at = ${ts} WHERE source_id = ${id}`)
  await db.execute(sql`UPDATE approval_instances SET created_at = ${ts}, updated_at = ${ts} WHERE document_id = ${id}`)
  await db.execute(sql`UPDATE approval_instance_logs SET approved_at = ${ts}, created_at = ${ts} WHERE instance_id IN (SELECT id FROM approval_instances WHERE document_id = ${id})`)
  await db.execute(sql.raw(`UPDATE ${table} SET created_at = '${ts}', updated_at = '${ts}' WHERE id = '${id}'`))
}

async function main() {
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(s.products)
  if (existing[0].n > 5 && !process.argv.includes('--force')) {
    console.log('Products already exist — skipping (use --force to seed anyway).')
    process.exit(0)
  }

  // ================= MASTER DATA =================
  console.log('Seeding master data...')

  // roles & users
  const roleIds: Record<string, string> = {}
  for (const name of ['admin', 'manager', 'staff']) {
    let r = await db.query.roles.findFirst({ where: eq(s.roles.name, name) })
    if (!r) [r] = await db.insert(s.roles).values({ name }).returning()
    roleIds[name] = r!.id
  }
  const pwHash = await bcrypt.hash('Password123!', 10)
  const userDefs = [
    ['Administrator', 'admin@ims.local', 'admin'],
    ['Budi Santoso', 'budi.manager@ims.local', 'manager'],
    ['Siti Rahmawati', 'siti.manager@ims.local', 'manager'],
    ['Andi Wijaya', 'andi.staff@ims.local', 'staff'],
    ['Dewi Lestari', 'dewi.staff@ims.local', 'staff'],
    ['Rudi Hartono', 'rudi.staff@ims.local', 'staff'],
  ]
  const userIds: string[] = []
  for (const [name, email, role] of userDefs) {
    let u = await db.query.users.findFirst({ where: eq(s.users.email, email) })
    if (!u) [u] = await db.insert(s.users).values({ name, email, password_hash: pwHash, role_id: roleIds[role] }).returning()
    userIds.push(u!.id)
  }
  const adminId = userIds[0]

  // approval workflows (single step: role admin)
  for (const [docType, name] of [
    ['product_request', 'Product Request Approval'],
    ['po', 'PO Approval'],
    ['receiving', 'Receiving Approval'],
    ['purchase_return', 'Purchase Return Approval'],
    ['adjustment', 'Stock Adjustment Approval'],
  ]) {
    let wf = await db.query.approvalWorkflows.findFirst({ where: eq(s.approvalWorkflows.document_type, docType) })
    if (!wf) {
      ;[wf] = await db.insert(s.approvalWorkflows).values({ document_type: docType, name, is_active: true }).returning()
      await db.insert(s.approvalSteps).values({ workflow_id: wf.id, step_order: 1, approver_type: 'role', approver_id: roleIds.admin })
    }
  }

  // warehouses
  const whDefs = [
    ['WH-MAIN', 'Main Warehouse', 'main', 'Jl. Industri Raya No. 1, Bekasi'],
    ['WH-JKT', 'Gudang Jakarta', 'branch', 'Jl. Kapuk Raya No. 12, Jakarta Barat'],
    ['WH-SBY', 'Gudang Surabaya', 'branch', 'Jl. Rungkut Industri No. 8, Surabaya'],
    ['WH-BDG', 'Gudang Bandung', 'branch', 'Jl. Soekarno-Hatta No. 210, Bandung'],
    ['WH-TRN', 'Gudang Transit', 'transit', 'Jl. Pelabuhan No. 3, Cikarang'],
  ]
  const warehouses: { id: string; code: string }[] = []
  for (const [code, name, type, address] of whDefs) {
    let w = await db.query.warehouses.findFirst({ where: eq(s.warehouses.code, code) })
    if (!w) [w] = await db.insert(s.warehouses).values({ code, name, type, address }).returning()
    warehouses.push({ id: w!.id, code })
  }
  const stockWhs = warehouses.filter((w) => w.code !== 'WH-TRN') // transit stays empty except transfers

  // units
  const unitNames = ['pcs', 'box', 'dus', 'pack', 'kg', 'liter', 'lusin', 'set']
  const unitRows = await db.insert(s.units).values(unitNames.map((name) => ({ name }))).returning()
  const unit = Object.fromEntries(unitRows.map((u) => [u.name, u.id]))

  // categories (parent -> children)
  const catTree: Record<string, string[]> = {
    Elektronik: ['Audio', 'Charger & Kabel', 'Smart Device'],
    'Peralatan Rumah': ['Dapur', 'Kebersihan'],
    ATK: ['Kertas', 'Alat Tulis'],
    'Makanan & Minuman': ['Snack', 'Minuman'],
    'Perawatan Pribadi': ['Sabun & Sampo', 'Kosmetik'],
    Otomotif: ['Oli & Pelumas', 'Aksesoris Kendaraan'],
  }
  const cat: Record<string, string> = {}
  for (const [parent, kids] of Object.entries(catTree)) {
    const [p] = await db.insert(s.productCategories).values({ name: parent }).returning()
    cat[parent] = p.id
    for (const k of kids) {
      const [c] = await db.insert(s.productCategories).values({ name: k, parent_id: p.id }).returning()
      cat[k] = c.id
    }
  }

  // products: [sku, name, category, unit, cost, packUnit?, packQty?]
  const productDefs: [string, string, string, string, number, string?, number?][] = [
    ['ELK-001', 'Earphone Bluetooth TWS X1', 'Audio', 'pcs', 145000, 'box', 10],
    ['ELK-002', 'Headset Gaming HG-200', 'Audio', 'pcs', 210000, 'box', 5],
    ['ELK-003', 'Speaker Portable Mini', 'Audio', 'pcs', 175000, 'box', 6],
    ['ELK-004', 'Charger Fast 20W', 'Charger & Kabel', 'pcs', 65000, 'dus', 20],
    ['ELK-005', 'Kabel USB-C 1m', 'Charger & Kabel', 'pcs', 18000, 'dus', 50],
    ['ELK-006', 'Power Bank 10000mAh', 'Charger & Kabel', 'pcs', 135000, 'box', 10],
    ['ELK-007', 'Smartwatch Fit Pro', 'Smart Device', 'pcs', 320000, 'box', 5],
    ['ELK-008', 'CCTV Wifi Indoor', 'Smart Device', 'pcs', 190000, 'box', 8],
    ['RMH-001', 'Panci Stainless 24cm', 'Dapur', 'pcs', 95000, 'dus', 6],
    ['RMH-002', 'Set Pisau Dapur 5 pcs', 'Dapur', 'set', 120000, 'dus', 10],
    ['RMH-003', 'Rice Cooker 1.8L', 'Dapur', 'pcs', 285000, 'dus', 4],
    ['RMH-004', 'Sapu Lantai Premium', 'Kebersihan', 'pcs', 32000, 'lusin', 12],
    ['RMH-005', 'Pel Ultra Spin', 'Kebersihan', 'pcs', 115000, 'dus', 6],
    ['RMH-006', 'Cairan Pembersih Lantai 1L', 'Kebersihan', 'liter', 14500, 'dus', 12],
    ['ATK-001', 'Kertas HVS A4 70gsm', 'Kertas', 'pack', 42000, 'dus', 5],
    ['ATK-002', 'Kertas HVS F4 80gsm', 'Kertas', 'pack', 52000, 'dus', 5],
    ['ATK-003', 'Buku Tulis 38 lbr', 'Kertas', 'pcs', 3200, 'lusin', 12],
    ['ATK-004', 'Pulpen Gel 0.5mm', 'Alat Tulis', 'pcs', 2800, 'box', 50],
    ['ATK-005', 'Spidol Whiteboard', 'Alat Tulis', 'pcs', 6500, 'lusin', 12],
    ['ATK-006', 'Stapler Besar', 'Alat Tulis', 'pcs', 24000, 'lusin', 12],
    ['MKN-001', 'Keripik Kentang 150g', 'Snack', 'pack', 9500, 'dus', 24],
    ['MKN-002', 'Biskuit Cokelat 200g', 'Snack', 'pack', 8200, 'dus', 24],
    ['MKN-003', 'Kacang Panggang 250g', 'Snack', 'pack', 12500, 'dus', 20],
    ['MKN-004', 'Air Mineral 600ml', 'Minuman', 'pcs', 2400, 'dus', 24],
    ['MKN-005', 'Teh Botol 350ml', 'Minuman', 'pcs', 3600, 'dus', 24],
    ['MKN-006', 'Kopi Instan 20 sachet', 'Minuman', 'pack', 21000, 'dus', 12],
    ['MKN-007', 'Susu UHT 1L', 'Minuman', 'liter', 16500, 'dus', 12],
    ['PRW-001', 'Sabun Mandi Cair 450ml', 'Sabun & Sampo', 'pcs', 18500, 'dus', 12],
    ['PRW-002', 'Sampo Anti Ketombe 340ml', 'Sabun & Sampo', 'pcs', 27000, 'dus', 12],
    ['PRW-003', 'Sabun Cuci Tangan 250ml', 'Sabun & Sampo', 'pcs', 12000, 'dus', 24],
    ['PRW-004', 'Lipstik Matte', 'Kosmetik', 'pcs', 38000, 'lusin', 12],
    ['PRW-005', 'Bedak Padat SPF 30', 'Kosmetik', 'pcs', 45000, 'lusin', 12],
    ['PRW-006', 'Serum Wajah 30ml', 'Kosmetik', 'pcs', 68000, 'lusin', 12],
    ['OTO-001', 'Oli Mesin 1L 10W-40', 'Oli & Pelumas', 'liter', 58000, 'dus', 12],
    ['OTO-002', 'Oli Gardan 120ml', 'Oli & Pelumas', 'pcs', 14000, 'dus', 24],
    ['OTO-003', 'Pelumas Rantai Spray', 'Oli & Pelumas', 'pcs', 26000, 'dus', 24],
    ['OTO-004', 'Cover Motor All Size', 'Aksesoris Kendaraan', 'pcs', 55000, 'lusin', 12],
    ['OTO-005', 'Holder HP Motor', 'Aksesoris Kendaraan', 'pcs', 42000, 'lusin', 12],
    ['OTO-006', 'Wiper Mobil 20"', 'Aksesoris Kendaraan', 'pcs', 36000, 'lusin', 12],
    ['OTO-007', 'Pengharum Mobil Gantung', 'Aksesoris Kendaraan', 'pcs', 9000, 'lusin', 12],
  ]
  type Prod = { id: string; sku: string; cost: number; sell: number; velocity: number }
  const products: Prod[] = []
  for (const [sku, name, category, u, cost, packUnit, packQty] of productDefs) {
    const [p] = await db
      .insert(s.products)
      .values({ sku, name, category_id: cat[category], base_unit_id: unit[u], costing_method: 'fifo', is_active: sku !== 'OTO-007' })
      .returning()
    if (packUnit && packQty) {
      await db.insert(s.productUnits).values({ product_id: p.id, unit_id: unit[packUnit], conversion_qty: packQty.toString() })
    }
    products.push({ id: p.id, sku, cost, sell: Math.round((cost * (1.15 + rnd() * 0.3)) / 500) * 500, velocity: 0.3 + rnd() * 1.7 })
  }
  // OTO-007 is deliberately inactive and never traded (dead product example)
  const tradable = products.filter((p) => p.sku !== 'OTO-007')
  // a few products are "dead stock": bought once early, never sold
  const deadSkus = new Set(['ELK-008', 'PRW-006', 'RMH-003'])
  for (const p of products) if (deadSkus.has(p.sku)) p.velocity = 0

  // suppliers
  const supplierDefs = [
    ['PT Sumber Elektronik Jaya', 'Hendra', '0812-1111-0001', 30, 7],
    ['CV Mitra Gadget Nusantara', 'Lina', '0812-1111-0002', 14, 5],
    ['PT Global Homeware', 'Yusuf', '0812-1111-0003', 45, 10],
    ['UD Sinar Kertas', 'Agus', '0812-1111-0004', 7, 3],
    ['PT Prima Pangan Makmur', 'Ratna', '0812-1111-0005', 21, 4],
    ['CV Segar Minuman Abadi', 'Toni', '0812-1111-0006', 14, 3],
    ['PT Kosmetika Indah', 'Maya', '0812-1111-0007', 30, 8],
    ['PT Sabun Bersih Sejahtera', 'Dodi', '0812-1111-0008', 30, 6],
    ['CV Oto Parts Sentosa', 'Fajar', '0812-1111-0009', 14, 5],
    ['PT Lubrindo Perkasa', 'Wawan', '0812-1111-0010', 45, 9],
    ['CV Grosir Serba Ada', 'Nina', '0812-1111-0011', 0, 2],
    ['UD Berkah Distribusi', 'Slamet', '0812-1111-0012', 7, 3],
  ]
  const suppliers = await db
    .insert(s.suppliers)
    .values(supplierDefs.map(([name, contact, phone, term, lead], i) => ({
      name: name as string,
      contact: contact as string,
      phone: phone as string,
      payment_term_days: term as number,
      default_lead_time_days: lead as number,
      is_active: i !== 11,
    })))
    .returning()
  const activeSuppliers = suppliers.filter((x) => x.is_active)

  // expeditions
  const expDefs: [string, string, string][] = [
    ['JNE Cargo', 'CS JNE', 'per_weight'], ['J&T Express', 'CS J&T', 'per_qty'], ['SiCepat Halu', 'CS SiCepat', 'per_value'],
    ['Wahana Logistik', 'CS Wahana', 'per_qty'], ['Indah Cargo', 'CS Indah', 'per_weight'], ['Tiki Freight', 'CS Tiki', 'per_value'],
  ]
  const expeditions = await db
    .insert(s.expeditions)
    .values(expDefs.map(([name, contact, m]) => ({ name, contact, default_allocation_method: m })))
    .returning()

  // stock settings: product-level + a few warehouse-specific overrides
  for (const p of tradable.slice(0, 20)) {
    await db.insert(s.productStockSettings).values({
      product_id: p.id, min_stock: '20', reorder_point: '50', reorder_qty: '100',
    })
  }
  for (const p of tradable.slice(0, 6)) {
    await db.insert(s.productStockSettings).values({
      product_id: p.id, warehouse_id: warehouses[1].id, min_stock: '40', reorder_point: '90', reorder_qty: '200',
      fast_moving_min_daily_out: '8', slow_moving_max_daily_out: '1', aging_warning_days: 20, aging_danger_days: 45,
    })
  }

  // ================= TRANSACTIONS =================
  console.log('Seeding transactions (this takes a minute)...')

  const start = new Date('2026-03-01T00:00:00')
  const end = new Date('2026-09-17T00:00:00')

  const stockOf = async () => {
    const rows = await db.select().from(s.stockSummary).where(gt(s.stockSummary.qty_available, '0'))
    const m = new Map<string, number>() // `${wh}:${product}` -> available
    for (const r of rows) m.set(`${r.warehouse_id}:${r.product_id}`, Number(r.qty_available))
    return m
  }

  type Queued = () => Promise<void>
  const queue = new Map<string, Queued[]>()
  const schedule = (d: Date, fn: Queued) => {
    const k = dstr(d)
    if (!queue.has(k)) queue.set(k, [])
    queue.get(k)!.push(fn)
  }

  const approvedReceivings: { id: string; warehouse_id: string }[] = []
  let day1 = true

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const today = new Date(d)
    const due = queue.get(dstr(today)) ?? []
    queue.delete(dstr(today))
    for (const fn of due) await fn()

    // ---- purchasing: initial big buy on day 1, then ~35% of days ----
    const poCount = day1 ? 8 : chance(0.35) ? int(1, 2) : 0
    for (let n = 0; n < poCount; n++) {
      const supplier = pick(activeSuppliers)
      const wh = pick(stockWhs)
      const picked = shuffle(tradable).slice(0, int(2, 6))
      // fast movers get bigger orders; dead-stock products only bought early
      const lines = picked
        .filter((p) => !(deadSkus.has(p.sku) && !day1))
        .map((p) => ({
          product_id: p.id,
          qty_order: Math.round((day1 ? int(80, 200) : int(40, 160)) * (0.6 + p.velocity)),
          price: Math.round((p.cost * (0.95 + rnd() * 0.1)) / 100) * 100,
        }))
      if (lines.length === 0) continue

      const po: any = await attempt('purchase_orders', () =>
        createPurchaseOrder({ supplier_id: supplier.id, warehouse_id: wh.id, order_date: dstr(today), currency: 'IDR', exchange_rate: 1, created_by: pick(userIds), items: lines }),
      )
      if (!po) continue
      await backdate(po.id, 'purchase_orders', today)

      const fate = rnd()
      if (!day1 && fate < 0.08) continue // stays draft
      const sub = await attempt('po_submit', () => submitPurchaseOrder(po.id))
      if (!sub) continue
      await backdate(po.id, 'purchase_orders', addDays(today, 0))
      if (!day1 && fate < 0.14) continue // waiting approval
      if (!day1 && fate < 0.19) {
        await attempt('po_reject', () => rejectPurchaseOrder(po.id, adminId, 'Harga belum sesuai kesepakatan'))
        await backdate(po.id, 'purchase_orders', addDays(today, 1))
        continue
      }
      await attempt('po_approve', () => approvePurchaseOrder(po.id, adminId, 'OK'))
      await backdate(po.id, 'purchase_orders', addDays(today, 1))

      // shipment ship+2d, receiving +5..8d (skipped if it would land in the future)
      const shipDate = addDays(today, 2)
      const recvDate = addDays(today, int(5, 8))
      if (recvDate > end && chance(0.6)) continue // still "in the PO stage"
      const exp = pick(expeditions)
      const ship: any = await attempt('shipments', () =>
        createShipmentWithItems({
          expedition_id: exp.id,
          ship_date: dstr(shipDate),
          total_shipping_cost: int(3, 25) * 100000,
          allocation_method: exp.default_allocation_method as any,
          po_ids: [po.id],
          items: po.items.map((it: any) => ({
            po_item_id: it.id,
            qty_shipped: Number(it.qty_order),
            weight: int(1, 40),
          })),
        }),
      )
      if (!ship) continue
      await backdate(ship.id, 'shipments', shipDate)
      if (recvDate > end) continue // shipped, not yet received

      const doReceive = async () => {
        const partial = chance(0.25)
        const rcv: any = await attempt('receivings', () =>
          createReceivingWithItems({
            shipment_id: ship.id,
            warehouse_id: wh.id,
            receive_date: dstr(recvDate),
            created_by: pick(userIds),
            items: ship.items.map((si: any) => ({
              shipment_item_id: si.id,
              po_item_id: si.po_item_id,
              product_id: po.items.find((i: any) => i.id === si.po_item_id).product_id,
              qty_received: Math.max(1, Math.round(Number(si.qty_shipped) * (partial ? 0.5 + rnd() * 0.3 : 1))),
            })),
          }),
        )
        if (!rcv) return
        await backdate(rcv.id, 'receivings', recvDate)
        const f = rnd()
        if (f < 0.05) return // draft
        await attempt('receiving_submit', () => submitReceiving(rcv.id))
        if (f < 0.1) { await backdate(rcv.id, 'receivings', recvDate); return }
        if (f < 0.13) {
          await attempt('receiving_reject', () => rejectReceiving(rcv.id, adminId, 'Kemasan rusak, cek ulang'))
          await backdate(rcv.id, 'receivings', recvDate)
          return
        }
        const ok = await attempt('receiving_approve', () => approveReceiving(rcv.id, adminId, 'Barang sesuai'))
        await backdate(rcv.id, 'receivings', recvDate)
        await backdate(po.id, 'purchase_orders', addDays(today, 1)) // keep PO's own timestamps stable
        if (ok) approvedReceivings.push({ id: rcv.id, warehouse_id: wh.id })
      }
      if (day1 || recvDate <= today) await doReceive()
      else schedule(recvDate, doReceive)
    }
    day1 = false

    // stock must exist before returns/transfers — first week is buying only
    if (today < addDays(start, 10)) continue

    // ---- purchase returns (~1 / month) ----
    if (chance(0.05) && approvedReceivings.length) {
      const r = pick(approvedReceivings)
      const layers = await db.select().from(s.stockLayers).where(and(eq(s.stockLayers.source_id, r.id), gt(s.stockLayers.qty_remaining, '5')))
      if (layers.length) {
        const layer = pick(layers)
        const pr: any = await attempt('purchase_returns', () =>
          createPurchaseReturnWithItems({
            receiving_id: r.id,
            warehouse_id: r.warehouse_id,
            return_date: dstr(today),
            reason: pick(['Barang cacat produksi', 'Tidak sesuai spesifikasi', 'Kemasan rusak saat diterima', 'Salah kirim varian']),
            items: [{ product_id: layer.product_id, stock_layer_id: layer.id, qty_return: Math.max(1, Math.floor(Number(layer.qty_remaining) * 0.1)) }],
          }),
        )
        if (pr) {
          await backdate(pr.id, 'purchase_returns', today)
          if (!chance(0.15)) {
            await attempt('pr_submit', () => submitPurchaseReturn(pr.id))
            await attempt('pr_approve', () => approvePurchaseReturn(pr.id, adminId, 'Setuju retur'))
            await backdate(pr.id, 'purchase_returns', today)
          }
        }
      }
    }

    // ---- stock transfers (~weekly) ----
    if (chance(0.15)) {
      const from = pick(stockWhs)
      let to = pick(warehouses)
      if (to.id === from.id) to = warehouses[4]
      const layers = await db
        .select()
        .from(s.stockLayers)
        .where(and(eq(s.stockLayers.warehouse_id, from.id), gt(s.stockLayers.qty_remaining, '20'), eq(s.stockLayers.status, 'active')))
        .limit(40)
      if (layers.length >= 2) {
        const chosen = shuffle(layers).slice(0, int(1, 3))
        const tr: any = await attempt('stock_transfers', () =>
          createAndExecuteTransfer({
            from_warehouse_id: from.id,
            to_warehouse_id: to.id,
            transfer_date: dstr(today),
            items: chosen.map((l) => ({ product_id: l.product_id, stock_layer_id: l.id, qty: Math.max(1, Math.floor(Number(l.qty_remaining) * (0.2 + rnd() * 0.3))) })),
          }),
        )
        if (tr) await backdate(tr.id, 'stock_transfers', today)
      }
    }

    // ---- stock adjustments (~biweekly) ----
    if (chance(0.08)) {
      const wh = pick(stockWhs)
      const stock = await stockOf()
      const holdings = tradable.filter((p) => (stock.get(`${wh.id}:${p.id}`) ?? 0) > 15)
      if (holdings.length >= 2) {
        const [a, b] = shuffle(holdings)
        const items = [
          { product_id: a.id, qty_diff: -int(1, 6) }, // shrinkage
          { product_id: b.id, qty_diff: int(2, 8), hpp: a.cost },
        ]
        items[1].hpp = b.cost
        const adj: any = await attempt('stock_adjustments', () =>
          createAdjustmentWithItems({ warehouse_id: wh.id, adjustment_date: dstr(today), reason: pick(['Stock opname bulanan', 'Barang hilang/rusak', 'Koreksi selisih hitung', 'Temuan barang saat opname']), items }),
        )
        if (adj) {
          await backdate(adj.id, 'stock_adjustments', today)
          const f = rnd()
          if (f > 0.1) {
            await attempt('adj_submit', () => submitAdjustment(adj.id))
            if (f > 0.2) {
              if (f > 0.92) await attempt('adj_reject', () => rejectAdjustment(adj.id, adminId, 'Perlu dicek ulang'))
              else await attempt('adj_approve', () => approveAdjustment(adj.id, adminId, 'Disetujui'))
            }
            await backdate(adj.id, 'stock_adjustments', today)
          }
        }
      }
    }
  }

  // ================= PRODUCT REQUEST → COMPARISON =================
  console.log('Seeding product requests & comparisons...')
  const reqA: any = await attempt('product_requests', () =>
    createProductRequest({
      title: 'Lampu LED outdoor 50W',
      notes: 'Untuk proyek penerangan gudang baru',
      needs_approval: true,
      requested_by: adminId,
      items: [{ name: 'LED Flood Light 50W', spec: 'IP66, 6500K', qty: 200, unit: 'pcs' }],
    }),
  )
  if (reqA) {
    await attempt('request_submit', () => submitProductRequest(reqA.id))
    await attempt('request_approve', () => approveProductRequest(reqA.id, adminId, 'OK, lanjut bandingkan'))
    const cmp: any = await attempt('product_comparisons', () =>
      createProductComparison({ request_id: reqA.id, title: 'Perbandingan LED 50W', exchange_rate: 2250, created_by: adminId }),
    )
    if (cmp) {
      const itemId = reqA.items[0].id
      const offers = [
        { name: 'LED-FL50-A', price: 12.5, currency: 'RMB' as const, weight_kg: 0.8, lead_time_days: 20, pack_length_cm: 22, pack_width_cm: 12, pack_height_cm: 7 },
        { name: 'LED-FL50-B', price: 31000, currency: 'IDR' as const, weight_kg: 1.1, lead_time_days: 7, pack_length_cm: 25, pack_width_cm: 14, pack_height_cm: 9 },
        { name: 'LED-FL50-C', price: 14, currency: 'RMB' as const, weight_kg: 0.7, lead_time_days: 25, pack_length_cm: 21, pack_width_cm: 11, pack_height_cm: 6 },
      ]
      const cands: any[] = []
      for (const o of offers) {
        const c = await attempt('comparison_candidates', () =>
          addCandidate(cmp.id, { request_item_id: itemId, supplier_id: pick(activeSuppliers).id, ...o } as any),
        )
        if (c) cands.push(c)
      }
      if (cands[0]) {
        await attempt('candidate_select', () => setCandidateSelected(cands[0].id, true))
        await attempt('candidate_promote', () => promoteCandidates(cmp.id, [{ candidate_id: cands[0].id, sku: 'LED-FL50-A' }]))
      }
    }
    await attempt('comments', () =>
      addComment({ ref_type: 'request', ref_id: reqA.id, user_id: adminId, message: 'Sampel batch lalu ada yang solder-nya longgar, minta QC ketat.', is_issue: true }),
    )
  }
  const reqB: any = await attempt('product_requests', () =>
    createProductRequest({ title: 'Kabel power 5m', needs_approval: false, requested_by: adminId, items: [{ name: 'Kabel power 5m', qty: 50, unit: 'pcs' }] }),
  )
  if (reqB) await attempt('request_submit', () => submitProductRequest(reqB.id))

  // ================= ANALYTICS / JOBS =================
  console.log('Running analytics jobs...')
  for (const [name, fn] of [
    ['movement-classification', runMovementClassificationJob],
    ['stock-valuation-snapshot', runStockValuationSnapshotJob],
    ['aging-check', runAgingCheckJob],
  ] as const) {
    try { await fn(); console.log('  ✓', name) } catch (e: any) { console.log('  ✗', name, e?.message) }
  }

  console.log('\nCreated:')
  for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k.padEnd(22)} ${v}`)
  if (Object.keys(failed).length) {
    console.log('\nSkipped (business-rule rejections during simulation):')
    for (const [k, v] of Object.entries(failed).sort()) console.log(`  ${k.padEnd(45)} ${v}`)
  }
  console.log('\nDemo seed completed. Login: admin@ims.local / Admin123! (others: Password123!)')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
