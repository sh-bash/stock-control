# PRD — Inventory Control System (Purchase, Stock, Sale)
**Codename:** IMS (Inventory Management System) — bagian dari ekosistem internal GII
**Versi Dokumen:** 2.0 (Full Detail — siap eksekusi CLI)
**Tanggal:** 16 September 2026
**Author:** Rizki (IT Lead, GII)

> Dokumen ini ditulis untuk dieksekusi oleh AI coding assistant (Claude Code CLI) secara bertahap per Fase. Setiap Fase punya task list konkret dan acceptance criteria. Assistant tidak perlu menebak struktur kolom — semua sudah didefinisikan di §5.

---

## 1. Overview

### 1.1 Tujuan
Membangun sistem kontrol Product, Stock, dan Nilai Persediaan yang terintegrasi dari proses pembelian (Purchase) hingga penjualan (Sale), dengan HPP otomatis (FIFO), deteksi stock mengendap, proyeksi habis stock, dan notifikasi realtime.

### 1.2 Goals
1. Kontrol pergerakan stock (in/out) secara akurat dan auditable
2. Deteksi dini stock yang mengendap terlalu lama di gudang
3. Proyeksi kapan stock akan habis berdasarkan kecepatan pergerakan historis
4. Notifikasi realtime (bell + popup) untuk kondisi kritis
5. Multi-warehouse
6. API-first — siap dipakai web (Nuxt 3) dan mobile di masa depan

### 1.3 Non-Goals
- Integrasi auto-posting jurnal akuntansi ke Dementer
- Toleransi over/under qty di tiap step transaksi
- Multi-currency
- Approval workflow default bawaan sistem (semua workflow di-define bebas oleh user)

### 1.4 Metode Costing
**FIFO (First In First Out)** — wajib. Setiap Receiving membentuk 1 stock layer baru dengan HPP masing-masing. Barang keluar mengambil dari layer tertua dulu.

---

## 2. Tech Stack & Arsitektur

| Layer | Teknologi |
|---|---|
| Frontend Web | Vue 3 + Nuxt 3 |
| Backend | Nuxt 3 Server Routes (Nitro) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | JWT (access + refresh token) |
| Realtime | Server-Sent Events (SSE) |
| State Management | Pinia |
| UI | Modern Material Design |
| Charting | ApexCharts (`vue3-apexcharts`) |

### 2.1 Struktur Folder Backend
```
/server
  /api/v1
    /auth/{login,refresh,logout}.post.ts
    /products/{index,[id]}.{get,post,put}.ts
    /warehouses/...
    /suppliers/...
    /customers/...
    /expeditions/...
    /purchase-orders/{index,[id],[id]/approve}.ts
    /shipments/...
    /receivings/{index,[id],[id]/approve}.ts
    /purchase-returns/...
    /sale-orders/{index,[id],[id]/approve}.ts
    /delivery-orders/{index,[id],[id]/approve}.ts
    /sale-returns/...
    /stock/{summary,ledger,aging,projection,transfers,adjustments}.ts
    /notifications/{stream,index,[id]/read,rules}.ts
    /reports/{purchase,sale,inventory-valuation,mutation}.ts
  /services
    auth.service.ts
    product.service.ts
    purchase-order.service.ts
    shipment.service.ts
    receiving.service.ts        <- FIFO layer creation logic
    stock.service.ts             <- FIFO consumption logic (CORE)
    sale-order.service.ts
    delivery-order.service.ts
    notification.service.ts
    approval.service.ts
    report.service.ts
  /repositories
    <table-name>.repository.ts   <- 1 file per entitas utama, Drizzle query layer
  /jobs
    movement-classification.job.ts   <- cron harian
    aging-check.job.ts                 <- cron harian
    stock-reconciliation.job.ts       <- cron mingguan
  /db
    schema.ts        <- semua tabel Drizzle (lihat §5)
    client.ts
    migrations/
```

### 2.2 Auth & API Convention
- JWT access token (15-60 menit) + refresh token (7-30 hari, revocable, disimpan di tabel `refresh_tokens`)
- Header: `Authorization: Bearer <token>`
- Semua route di `/api/v1/`
- Response format:
```json
{ "success": true, "data": {}, "message": null, "meta": {} }
```
- Error format:
```json
{ "success": false, "data": null, "message": "Stock tidak cukup", "meta": { "code": "INSUFFICIENT_STOCK" } }
```

---

## 3. Design Requirements (ringkas — detail visual menyusul saat Fase UI)
- Material Design: elevation halus, rounded corner konsisten
- Warna severity: danger=merah, warning=oranye, normal=hijau, info=biru
- Dashboard wajib berisi: Stock Value Overview, Aging Summary (donut chart), Movement Classification Summary, Low Stock Alert List, Purchase vs Sale Trend (line chart), Pending Approval Widget, Notification Bell
- Chart library: ApexCharts

---

## 4. Functional Flow Summary

### 4.1 Purchase
PO (qty, unit_price) → Shipment (bisa multi-PO, alokasi biaya kirim per qty/value/berat) → Receiving (HPP = unit_price + biaya_kirim_per_unit, generate stock layer baru) → Purchase Return (kurangi qty dari layer spesifik, referensi ke Receiving)

### 4.2 Sale
SO (qty, sell_price, checkbox `use_do`) → [jika use_do] DO (baru consume FIFO saat DO dibuat) / [jika !use_do] SO confirm langsung consume FIFO → Sale Return (referensi SO/DO, kondisi baik=restock atau rusak=damaged stock terpisah)

### 4.3 Stock
Setiap mutasi (Receiving, Purchase Return, Delivery, Sale Return, Transfer, Adjustment) → insert ke `stock_ledger` + update `stock_layers` + update `stock_summary`, semua dalam 1 DB transaction dengan row-level lock.

### 4.4 Approval
Generic untuk semua jenis dokumen. User define workflow bebas: jumlah step, approver per step (role dan/atau user).

### 4.5 Notification
Rule-based, scope bebas (global/category/product/warehouse), target bebas (role dan/atau user, additive/union). Delivery: bell (persistent) + popup (SSE realtime). Danger severity persistent sampai di-dismiss manual.

---

## 5. Database Schema — FULL DDL Reference

> Semua tabel pakai `id` UUID primary key, `created_at`, `updated_at` (timestamp), kecuali disebutkan lain. Foreign key mengikuti nama `<table>_id`.

### 5.1 Master Data

```sql
-- warehouses
id UUID PK
code VARCHAR(20) UNIQUE NOT NULL
name VARCHAR(100) NOT NULL
address TEXT
type VARCHAR(30)              -- main/transit/dll
is_active BOOLEAN DEFAULT true

-- products
id UUID PK
sku VARCHAR(50) UNIQUE NOT NULL
name VARCHAR(150) NOT NULL
category_id UUID FK -> product_categories.id
base_unit_id UUID FK -> units.id
costing_method VARCHAR(10) DEFAULT 'fifo'
is_active BOOLEAN DEFAULT true

-- product_categories
id UUID PK
name VARCHAR(100) NOT NULL
parent_id UUID NULL FK -> product_categories.id

-- units
id UUID PK
name VARCHAR(30) NOT NULL      -- pcs, box, kg, dll

-- product_units (konversi unit)
id UUID PK
product_id UUID FK -> products.id
unit_id UUID FK -> units.id
conversion_qty DECIMAL(18,4) NOT NULL  -- ke base_unit

-- suppliers
id UUID PK
name VARCHAR(150) NOT NULL
contact VARCHAR(100)
phone VARCHAR(30)
payment_term_days INT DEFAULT 0
default_lead_time_days INT DEFAULT 0
is_active BOOLEAN DEFAULT true

-- customers
id UUID PK
name VARCHAR(150) NOT NULL
contact VARCHAR(100)
phone VARCHAR(30)
payment_term_days INT DEFAULT 0
price_level_id UUID NULL FK -> price_levels.id
is_active BOOLEAN DEFAULT true

-- expeditions
id UUID PK
name VARCHAR(150) NOT NULL
contact VARCHAR(100)
default_allocation_method VARCHAR(20) DEFAULT 'per_value'  -- per_qty/per_value/per_weight
is_active BOOLEAN DEFAULT true

-- global_stock_settings (single row config)
id UUID PK
fast_moving_min_daily_out DECIMAL(18,4) NOT NULL
slow_moving_max_daily_out DECIMAL(18,4) NOT NULL
aging_warning_days INT NOT NULL
aging_danger_days INT NOT NULL
dead_stock_no_movement_days INT NOT NULL

-- product_stock_settings (override per product/warehouse, nullable = pakai global)
id UUID PK
product_id UUID FK -> products.id
warehouse_id UUID NULL FK -> warehouses.id   -- null = berlaku semua warehouse utk product ini
min_stock DECIMAL(18,4)
reorder_point DECIMAL(18,4)
reorder_qty DECIMAL(18,4)
fast_moving_min_daily_out DECIMAL(18,4) NULL
slow_moving_max_daily_out DECIMAL(18,4) NULL
aging_warning_days INT NULL
aging_danger_days INT NULL
is_active BOOLEAN DEFAULT true
```

### 5.2 Purchase

```sql
-- purchase_orders
id UUID PK
no_po VARCHAR(50) UNIQUE NOT NULL
supplier_id UUID FK -> suppliers.id
warehouse_id UUID FK -> warehouses.id
order_date DATE NOT NULL
status VARCHAR(30) DEFAULT 'draft'
  -- draft/waiting_approval/approved/partial_received/closed/cancelled
created_by UUID FK -> users.id

-- purchase_order_items
id UUID PK
po_id UUID FK -> purchase_orders.id
product_id UUID FK -> products.id
qty_order DECIMAL(18,4) NOT NULL
unit_price DECIMAL(18,2) NOT NULL
qty_received DECIMAL(18,4) DEFAULT 0   -- running total, auto-update

-- shipments
id UUID PK
no_shipment VARCHAR(50) UNIQUE NOT NULL
expedition_id UUID FK -> expeditions.id
ship_date DATE NOT NULL
total_shipping_cost DECIMAL(18,2) NOT NULL
allocation_method VARCHAR(20) NOT NULL  -- per_qty/per_value/per_weight
status VARCHAR(30) DEFAULT 'draft'

-- shipment_po_ref
id UUID PK
shipment_id UUID FK -> shipments.id
po_id UUID FK -> purchase_orders.id

-- shipment_items
id UUID PK
shipment_id UUID FK -> shipments.id
po_item_id UUID FK -> purchase_order_items.id
qty_shipped DECIMAL(18,4) NOT NULL
weight DECIMAL(18,4) NULL              -- opsional, dipakai jika allocation_method = per_weight
allocated_shipping_cost_per_unit DECIMAL(18,4)  -- hasil kalkulasi

-- receivings
id UUID PK
no_receiving VARCHAR(50) UNIQUE NOT NULL
shipment_id UUID FK -> shipments.id
warehouse_id UUID FK -> warehouses.id
receive_date DATE NOT NULL
status VARCHAR(30) DEFAULT 'draft'  -- draft/waiting_approval/approved
created_by UUID FK -> users.id

-- receiving_items
id UUID PK
receiving_id UUID FK -> receivings.id
shipment_item_id UUID FK -> shipment_items.id
po_item_id UUID FK -> purchase_order_items.id
product_id UUID FK -> products.id
qty_received DECIMAL(18,4) NOT NULL
unit_price DECIMAL(18,2) NOT NULL          -- copy dari PO item
shipping_cost_per_unit DECIMAL(18,4) NOT NULL  -- copy dari shipment item
hpp DECIMAL(18,4) NOT NULL                  -- = unit_price + shipping_cost_per_unit
stock_layer_id UUID NULL FK -> stock_layers.id  -- diisi setelah layer dibuat

-- purchase_returns
id UUID PK
no_return VARCHAR(50) UNIQUE NOT NULL
receiving_id UUID FK -> receivings.id
warehouse_id UUID FK -> warehouses.id
return_date DATE NOT NULL
reason TEXT
status VARCHAR(30) DEFAULT 'draft'

-- purchase_return_items
id UUID PK
return_id UUID FK -> purchase_returns.id
product_id UUID FK -> products.id
stock_layer_id UUID FK -> stock_layers.id
qty_return DECIMAL(18,4) NOT NULL
```

### 5.3 Sale

```sql
-- sale_orders
id UUID PK
no_so VARCHAR(50) UNIQUE NOT NULL
customer_id UUID FK -> customers.id
warehouse_id UUID FK -> warehouses.id
order_date DATE NOT NULL
use_do BOOLEAN DEFAULT false
status VARCHAR(30) DEFAULT 'draft'
  -- draft/waiting_approval/confirmed/partial_delivered/closed/cancelled
created_by UUID FK -> users.id

-- sale_order_items
id UUID PK
so_id UUID FK -> sale_orders.id
product_id UUID FK -> products.id
qty_order DECIMAL(18,4) NOT NULL
sell_price DECIMAL(18,2) NOT NULL
qty_delivered DECIMAL(18,4) DEFAULT 0

-- delivery_orders
id UUID PK
no_do VARCHAR(50) UNIQUE NOT NULL
so_id UUID FK -> sale_orders.id
warehouse_id UUID FK -> warehouses.id
delivery_date DATE NOT NULL
status VARCHAR(30) DEFAULT 'draft'

-- delivery_order_items
id UUID PK
do_id UUID FK -> delivery_orders.id
so_item_id UUID FK -> sale_order_items.id
product_id UUID FK -> products.id
qty_delivered DECIMAL(18,4) NOT NULL
cogs_per_unit DECIMAL(18,4)   -- hasil weighted average dari layer FIFO yang dipakai

-- sale_returns
id UUID PK
no_return VARCHAR(50) UNIQUE NOT NULL
source_type VARCHAR(10) NOT NULL   -- 'so' | 'do'
source_id UUID NOT NULL
return_date DATE NOT NULL
condition VARCHAR(10) NOT NULL     -- 'good' | 'damaged'
status VARCHAR(30) DEFAULT 'draft'

-- sale_return_items
id UUID PK
return_id UUID FK -> sale_returns.id
product_id UUID FK -> products.id
qty_return DECIMAL(18,4) NOT NULL
restore_hpp DECIMAL(18,4)   -- dari cogs_per_unit transaksi keluar asal
```

### 5.4 Stock (Core FIFO Engine)

```sql
-- stock_layers
id UUID PK
product_id UUID FK -> products.id
warehouse_id UUID FK -> warehouses.id
source_type VARCHAR(20) NOT NULL   -- receiving/adjustment/transfer_in
source_id UUID NOT NULL
receive_date DATE NOT NULL          -- dasar hitung aging & FIFO order
qty_original DECIMAL(18,4) NOT NULL
qty_remaining DECIMAL(18,4) NOT NULL
hpp DECIMAL(18,4) NOT NULL
status VARCHAR(10) DEFAULT 'active'  -- active/exhausted
-- INDEX: (product_id, warehouse_id, status, receive_date)

-- stock_ledger
id UUID PK
product_id UUID FK -> products.id
warehouse_id UUID FK -> warehouses.id
transaction_type VARCHAR(30) NOT NULL
  -- receiving/purchase_return/delivery/sale_return/transfer_in/transfer_out/adjustment
reference_type VARCHAR(30) NOT NULL
reference_id UUID NOT NULL
reference_no VARCHAR(50)
transaction_date TIMESTAMP NOT NULL
qty_in DECIMAL(18,4) DEFAULT 0
qty_out DECIMAL(18,4) DEFAULT 0
hpp_used DECIMAL(18,4)
running_balance_qty DECIMAL(18,4) NOT NULL
running_balance_value DECIMAL(18,4) NOT NULL
-- INDEX: (product_id, warehouse_id, transaction_date), (reference_type, reference_id)
-- PARTITION BY RANGE (transaction_date), per bulan

-- stock_consumption_log
id UUID PK
out_transaction_type VARCHAR(20) NOT NULL  -- delivery/transfer_out/adjustment
out_transaction_id UUID NOT NULL
stock_layer_id UUID FK -> stock_layers.id
qty_taken DECIMAL(18,4) NOT NULL
hpp DECIMAL(18,4) NOT NULL

-- stock_summary
id UUID PK
product_id UUID FK -> products.id
warehouse_id UUID FK -> warehouses.id
qty_on_hand DECIMAL(18,4) DEFAULT 0
qty_reserved DECIMAL(18,4) DEFAULT 0
qty_available DECIMAL(18,4) DEFAULT 0   -- computed: qty_on_hand - qty_reserved
total_value DECIMAL(18,4) DEFAULT 0
UNIQUE (product_id, warehouse_id)

-- stock_transfers
id UUID PK
no_transfer VARCHAR(50) UNIQUE NOT NULL
from_warehouse_id UUID FK -> warehouses.id
to_warehouse_id UUID FK -> warehouses.id
transfer_date DATE NOT NULL
status VARCHAR(30) DEFAULT 'draft'

-- stock_transfer_items
id UUID PK
transfer_id UUID FK -> stock_transfers.id
product_id UUID FK -> products.id
stock_layer_id UUID FK -> stock_layers.id
qty DECIMAL(18,4) NOT NULL

-- stock_adjustments
id UUID PK
no_adjustment VARCHAR(50) UNIQUE NOT NULL
warehouse_id UUID FK -> warehouses.id
adjustment_date DATE NOT NULL
reason TEXT
status VARCHAR(30) DEFAULT 'draft'

-- stock_adjustment_items
id UUID PK
adjustment_id UUID FK -> stock_adjustments.id
product_id UUID FK -> products.id
qty_diff DECIMAL(18,4) NOT NULL   -- + atau -
hpp DECIMAL(18,4)                  -- wajib diisi kalau qty_diff positif

-- stock_valuation_snapshot
id UUID PK
snapshot_date DATE NOT NULL
product_id UUID FK -> products.id
warehouse_id UUID FK -> warehouses.id
qty_on_hand DECIMAL(18,4) NOT NULL
total_value DECIMAL(18,4) NOT NULL
UNIQUE (snapshot_date, product_id, warehouse_id)
```

### 5.5 Analytics (Computed)

```sql
-- product_movement_stats
id UUID PK
product_id UUID FK -> products.id
warehouse_id UUID FK -> warehouses.id
avg_daily_out_qty_30d DECIMAL(18,4)
avg_daily_out_qty_90d DECIMAL(18,4)
last_movement_date DATE
days_since_last_movement INT
calculated_at TIMESTAMP

-- movement_classification
id UUID PK
product_id UUID FK -> products.id
warehouse_id UUID FK -> warehouses.id
classification VARCHAR(10) NOT NULL  -- fast/normal/slow/dead
calculated_at TIMESTAMP
```

### 5.6 Approval (Generic)

```sql
-- approval_workflows
id UUID PK
document_type VARCHAR(30) NOT NULL
  -- po/receiving/purchase_return/so/do/sale_return/adjustment/transfer
name VARCHAR(100) NOT NULL
is_active BOOLEAN DEFAULT true

-- approval_steps
id UUID PK
workflow_id UUID FK -> approval_workflows.id
step_order INT NOT NULL
approver_type VARCHAR(10) NOT NULL  -- 'role' | 'user'
approver_id UUID NOT NULL

-- approval_instances
id UUID PK
workflow_id UUID FK -> approval_workflows.id
document_type VARCHAR(30) NOT NULL
document_id UUID NOT NULL
current_step INT DEFAULT 1
status VARCHAR(20) DEFAULT 'pending'  -- pending/approved/rejected

-- approval_instance_logs
id UUID PK
instance_id UUID FK -> approval_instances.id
step_order INT NOT NULL
approver_id UUID FK -> users.id
action VARCHAR(10) NOT NULL  -- approve/reject
note TEXT
approved_at TIMESTAMP
```

### 5.7 Notification (Rule-based, Flexible)

```sql
-- notifications
id UUID PK
type VARCHAR(30) NOT NULL
  -- min_stock/reorder_point/aging_danger/aging_warning/slow_moving/dead_stock/approval_pending
severity VARCHAR(10) NOT NULL  -- info/warning/danger
title VARCHAR(200) NOT NULL
message TEXT NOT NULL
reference_type VARCHAR(30)
reference_id UUID
product_id UUID NULL FK -> products.id
warehouse_id UUID NULL FK -> warehouses.id

-- notification_recipients
id UUID PK
notification_id UUID FK -> notifications.id
user_id UUID FK -> users.id
is_read BOOLEAN DEFAULT false
read_at TIMESTAMP NULL

-- notification_rules
id UUID PK
type VARCHAR(30) NOT NULL
scope_type VARCHAR(20) NOT NULL  -- global/product/category/warehouse/product_warehouse
scope_id UUID NULL
is_active BOOLEAN DEFAULT true

-- notification_rule_targets
id UUID PK
rule_id UUID FK -> notification_rules.id
target_type VARCHAR(10) NOT NULL  -- 'role' | 'user'
target_id UUID NOT NULL

-- notification_settings
id UUID PK
user_id UUID FK -> users.id
type VARCHAR(30) NOT NULL
is_enabled BOOLEAN DEFAULT true
delivery_method VARCHAR(10) DEFAULT 'both'  -- bell/popup/both
```

### 5.8 Auth & Ops

```sql
-- users
id UUID PK
name VARCHAR(100) NOT NULL
email VARCHAR(150) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role_id UUID FK -> roles.id
is_active BOOLEAN DEFAULT true

-- roles
id UUID PK
name VARCHAR(50) UNIQUE NOT NULL

-- refresh_tokens
id UUID PK
user_id UUID FK -> users.id
token_hash VARCHAR(255) NOT NULL
expires_at TIMESTAMP NOT NULL
revoked_at TIMESTAMP NULL

-- job_execution_logs
id UUID PK
job_name VARCHAR(50) NOT NULL
status VARCHAR(10) NOT NULL  -- success/failed
rows_processed INT
duration_ms INT
error_message TEXT NULL
executed_at TIMESTAMP NOT NULL
```

---

## 6. Core Business Logic (WAJIB DIPAHAMI SEBELUM CODING)

### 6.1 FIFO Consumption (paling kritis)
```
FUNCTION consumeStock(product_id, warehouse_id, qty_needed, out_transaction):
  BEGIN TRANSACTION
    layers = SELECT * FROM stock_layers
             WHERE product_id=?, warehouse_id=?, status='active', qty_remaining > 0
             ORDER BY receive_date ASC
             FOR UPDATE   -- row lock, cegah race condition

    remaining_needed = qty_needed
    total_cogs = 0
    consumption_records = []

    FOR layer IN layers:
      IF remaining_needed <= 0: BREAK
      qty_taken = MIN(layer.qty_remaining, remaining_needed)
      layer.qty_remaining -= qty_taken
      IF layer.qty_remaining == 0: layer.status = 'exhausted'
      total_cogs += qty_taken * layer.hpp
      remaining_needed -= qty_taken
      consumption_records.push({layer_id: layer.id, qty_taken, hpp: layer.hpp})

    IF remaining_needed > 0:
      ROLLBACK
      THROW "INSUFFICIENT_STOCK"

    cogs_per_unit = total_cogs / qty_needed

    -- update stock_summary
    UPDATE stock_summary SET qty_on_hand -= qty_needed, total_value -= total_cogs
    WHERE product_id=?, warehouse_id=?

    -- insert stock_ledger
    INSERT INTO stock_ledger (..., qty_out=qty_needed, hpp_used=cogs_per_unit, ...)

    -- insert stock_consumption_log untuk setiap consumption_records
  COMMIT TRANSACTION
  RETURN cogs_per_unit
```

### 6.2 Receiving → Create Stock Layer
```
FUNCTION receiveStock(receiving_item):
  BEGIN TRANSACTION
    hpp = receiving_item.unit_price + receiving_item.shipping_cost_per_unit

    layer = INSERT INTO stock_layers (
      product_id, warehouse_id, source_type='receiving', source_id=receiving_item.receiving_id,
      receive_date, qty_original=qty, qty_remaining=qty, hpp, status='active'
    )

    UPDATE stock_summary SET qty_on_hand += qty, total_value += (qty * hpp)
    WHERE product_id=?, warehouse_id=?
    -- jika belum ada row, INSERT baru

    INSERT INTO stock_ledger (..., qty_in=qty, hpp_used=hpp, ...)

    UPDATE receiving_items SET stock_layer_id = layer.id
    UPDATE purchase_order_items SET qty_received += qty
  COMMIT TRANSACTION
```

### 6.3 Shipment Cost Allocation
```
FUNCTION allocateShippingCost(shipment):
  items = shipment.items
  IF method == 'per_qty':
    total_qty = SUM(items.qty_shipped)
    FOR item IN items: item.allocated_cost_per_unit = shipment.total_shipping_cost / total_qty

  IF method == 'per_value':
    total_value = SUM(items.qty_shipped * po_item.unit_price)
    FOR item IN items:
      item_value = item.qty_shipped * item.po_item.unit_price
      proportion = item_value / total_value
      item.allocated_cost_per_unit = (shipment.total_shipping_cost * proportion) / item.qty_shipped

  IF method == 'per_weight':
    total_weight = SUM(items.weight)
    FOR item IN items:
      proportion = item.weight / total_weight
      item.allocated_cost_per_unit = (shipment.total_shipping_cost * proportion) / item.qty_shipped
```

### 6.4 Sale Order dengan use_do
```
IF so.use_do == false:
  ON so.status -> 'confirmed':
    FOR item IN so.items: consumeStock(item.product_id, so.warehouse_id, item.qty_order, {type:'delivery', ref: so.id})
    so.status = 'closed'

IF so.use_do == true:
  ON so.status -> 'confirmed':
    FOR item IN so.items:
      UPDATE stock_summary SET qty_reserved += item.qty_order
      -- qty_available otomatis recompute (qty_on_hand - qty_reserved)

  ON delivery_order.status -> 'approved':
    FOR item IN do.items:
      cogs = consumeStock(item.product_id, do.warehouse_id, item.qty_delivered, {type:'delivery', ref: do.id})
      item.cogs_per_unit = cogs
      UPDATE stock_summary SET qty_reserved -= item.qty_delivered
      UPDATE sale_order_items SET qty_delivered += item.qty_delivered
```

### 6.5 Movement Classification (job harian)
```
FOR EACH product+warehouse combination WITH activity:
  avg_30d = AVG(qty_out per hari, 30 hari terakhir) dari stock_ledger
  settings = COALESCE(product_stock_settings, global_stock_settings)

  IF avg_30d >= settings.fast_moving_min_daily_out: classification = 'fast'
  ELSE IF avg_30d == 0 AND days_since_last_movement >= settings.dead_stock_no_movement_days: classification = 'dead'
  ELSE IF avg_30d <= settings.slow_moving_max_daily_out: classification = 'slow'
  ELSE: classification = 'normal'

  UPSERT movement_classification
```

### 6.6 Projection Habis Stock
```
projected_days_to_zero = qty_on_hand / avg_daily_out_qty_30d   (jika avg > 0)
projected_zero_date = today + projected_days_to_zero
-- jika avg_daily_out_qty_30d == 0 -> tandai "Tidak ada proyeksi (Dead Stock)"
```

### 6.7 Notification Trigger
```
ON stock_summary updated:
  IF qty_on_hand <= settings.min_stock: createNotification(type='min_stock', severity='danger')
  ELSE IF qty_on_hand <= settings.reorder_point: createNotification(type='reorder_point', severity='warning')

FUNCTION createNotification(type, severity, product_id, warehouse_id, ...):
  matched_rules = SELECT * FROM notification_rules
    WHERE type=? AND is_active=true AND (
      scope_type='global' OR
      (scope_type='product' AND scope_id=product_id) OR
      (scope_type='warehouse' AND scope_id=warehouse_id) OR
      (scope_type='category' AND scope_id = product.category_id) OR
      (scope_type='product_warehouse' AND ...)
    )
  targets = UNION semua notification_rule_targets dari matched_rules  -- additive
  resolved_users = expand targets (role -> semua user dengan role itu, user -> langsung)

  notification = INSERT INTO notifications (...)
  FOR user IN resolved_users:
    IF notification_settings(user, type).is_enabled:
      INSERT INTO notification_recipients (notification_id, user_id)
      EMIT SSE event ke user tersebut
```

---

## 7. Development Milestones — Task Breakdown per Fase

### FASE 1 — Setup & Master Data
**Task:**
1. Init Nuxt 3 project, install Drizzle + PostgreSQL driver
2. Setup `db/schema.ts` untuk tabel §5.1 (Master) dan §5.8 (Auth)
3. Setup migration & seed awal (minimal 1 warehouse, 1 role admin, 1 user admin)
4. Implement Auth: login, refresh token, logout, middleware JWT verify
5. CRUD API + halaman UI untuk: Product, Product Category, Unit, Supplier, Customer, Expedition, Warehouse
6. Setup `global_stock_settings` (form single config)

**Acceptance Criteria:** Bisa login, dapat token, CRUD semua master data via API dan UI, data tersimpan sesuai schema §5.1.

---

### FASE 2 — Approval Workflow & Notification Dasar
**Task:**
1. Schema §5.6 (Approval) dan §5.7 (Notification)
2. UI untuk define Approval Workflow (pilih document_type, tambah step, assign approver role/user)
3. Service `approval.service.ts`: create instance, process approve/reject, advance step
4. SSE endpoint `/api/v1/notifications/stream`
5. `notification.service.ts` sesuai logic §6.7
6. UI Notification Bell (Pinia store + EventSource subscribe) + popup toast component
7. UI untuk define Notification Rules (scope + target bebas)

**Acceptance Criteria:** Bisa buat workflow approval custom, notifikasi realtime muncul di bell saat trigger manual (test endpoint), rule scope/target bisa dikombinasikan bebas.

---

### FASE 3 — Purchase: PO → Shipment → Receiving
**Task:**
1. Schema §5.2 (Purchase) + §5.4 (stock_layers, stock_ledger, stock_summary)
2. CRUD PO + hook approval workflow (document_type='po')
3. CRUD Shipment dengan multi-PO reference, implement `allocateShippingCost` (§6.3)
4. CRUD Receiving + hook approval, implement `receiveStock` (§6.2)
5. Update status otomatis PO (partial_received/closed) berdasarkan qty_received

**Acceptance Criteria:** PO → Shipment → Receiving berjalan end-to-end, stock_layers terbentuk dengan HPP benar (unit_price + shipping_cost_per_unit), stock_summary ter-update, approval flow jalan.

---

### FASE 4 — Purchase Return, Transfer, Adjustment
**Task:**
1. Schema §5.2 (purchase_returns) + §5.4 (transfers, adjustments)
2. CRUD Purchase Return, kurangi qty dari stock_layer spesifik + approval hook
3. CRUD Stock Transfer (pindah layer antar warehouse)
4. CRUD Stock Adjustment (+ approval hook untuk nilai signifikan)
5. Tool/command `rebuildStockSummary()` — hitung ulang stock_summary dari stock_ledger

**Acceptance Criteria:** Semua transaksi update stock_ledger + stock_layers + stock_summary secara atomic (test dengan transaksi concurrent), rebuild tool menghasilkan angka sama dengan yang live.

---

### FASE 5 — Product Stock Settings & Notification Hook
**Task:**
1. UI Product Stock Settings (override min_stock, reorder_point, threshold per product/warehouse)
2. Hook `createNotification` ke setiap update stock_summary (§6.7)
3. Testing: turunkan stock di bawah threshold, pastikan notifikasi & bell muncul realtime

**Acceptance Criteria:** Notifikasi min_stock/reorder_point muncul otomatis saat stock berubah, sesuai rule & target yang di-setting user.

---

### FASE 6 — Sale: SO → DO → Sale Return
**Task:**
1. Schema §5.3 (Sale)
2. CRUD SO dengan checkbox `use_do`, implement logic §6.4
3. CRUD DO (hanya aktif kalau use_do=true), consume FIFO saat approved
4. CRUD Sale Return (kondisi good/damaged), restore stock sesuai §4.2

**Acceptance Criteria:** SO tanpa DO langsung consume stock saat confirm; SO dengan DO reserve dulu lalu consume saat DO approved; Sale Return restock dengan HPP asal (bukan average sekarang).

---

### FASE 7 — Scheduled Jobs
**Task:**
1. Job `movement-classification.job.ts` (§6.5), jalan harian, log ke `job_execution_logs`
2. Job `aging-check.job.ts` — hitung aging bucket dari stock_layers, trigger notification jika lewat threshold
3. Job `stock-reconciliation.job.ts` — mingguan, bandingkan stock_summary vs agregasi stock_layers, flag jika beda

**Acceptance Criteria:** Job jalan idempotent (jalankan 2x hasil sama), tercatat di job_execution_logs, notifikasi aging/slow-moving muncul sesuai threshold.

---

### FASE 8 — Report
**Task:**
1. `/api/v1/reports/purchase` — per supplier/periode, outstanding PO, price history
2. `/api/v1/reports/sale` — per customer/periode, COGS, margin
3. `/api/v1/reports/inventory-valuation` — dari stock_valuation_snapshot (buat snapshot job harian/bulanan)
4. `/api/v1/reports/mutation` — kartu stok per product dari stock_ledger

**Acceptance Criteria:** Semua report bisa difilter periode/warehouse/product, response time wajar untuk data besar (pakai index & computed table, bukan raw aggregation).

---

### FASE 9 — Dashboard & Chart
**Task:**
1. Widget Stock Value Overview, Aging Summary (donut ApexCharts), Movement Classification Summary
2. Widget Low Stock Alert List, Purchase vs Sale Trend (line chart), Pending Approval
3. Halaman Stock Aging & Projection detail (tabel sesuai contoh di histori planning)

**Acceptance Criteria:** Dashboard load cepat, chart menampilkan data real, semua widget terhubung ke computed table (bukan hitung on-the-fly berat).

---

### FASE 10 — Polish, Testing, API Docs
**Task:**
1. UI pass — konsistensi Material Design di semua halaman
2. Unit test untuk `consumeStock` dan `allocateShippingCost` (paling kritis)
3. Load test concurrency FIFO (simulasi transaksi bersamaan)
4. Generate OpenAPI/Swagger dari semua endpoint
5. Dokumentasi setup untuk tim (README + ENV setup)

**Acceptance Criteria:** Semua endpoint terdokumentasi di Swagger, tidak ada race condition lolos di load test, siap dipakai sebagai referensi untuk build mobile client.

---

## 8. Non-Functional Requirements (Reminder untuk tiap fase)
- Row-level locking (`FOR UPDATE`) wajib di semua fungsi consume/receive stock
- Composite index sesuai §5.4 wajib dibuat sejak migration awal, bukan ditambah belakangan
- Partitioning `stock_ledger` per bulan (setup dari Fase 3, jangan tunggu data besar)
- Semua service function idempotent-safe untuk job scheduler

---

## 9. Risks & Open Decisions (belum final, konfirmasi sebelum Fase terkait mulai)
| Item | Fase Terkait | Catatan |
|---|---|---|
| Default allocation_method Shipment | Fase 3 | Sementara default `per_value` di schema, konfirmasi ke Rizki jika beda |
| UI reference template Material | Fase 9-10 | Belum ada acuan visual spesifik |
| Estimasi skala data awal (SKU & transaksi/hari) | Fase 3 | Untuk validasi partitioning |

---

*Instruksi untuk Claude CLI: eksekusi Fase 1 terlebih dahulu, tunggu review, baru lanjut Fase berikutnya. Jangan skip acceptance criteria. Rujuk §5 untuk struktur kolom, §6 untuk logic bisnis, jangan mengasumsikan struktur di luar yang tertulis di sini.*
