<script setup lang="ts">
// Report endpoints already return a fully-computed, pre-filtered result set
// in one shot (they're aggregate views driven by the filter form above, not
// raw unbounded tables) — so BaseDataTable here paginates/sorts CLIENT-side
// over that already-small array, unlike the Master Data/Stock Ledger pages
// which paginate server-side. CSV export works off the same filtered rows.
interface Supplier { id: string; name: string }
interface Customer { id: string; name: string }
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }

const tab = ref<'purchase' | 'sale' | 'valuation' | 'mutation'>('purchase')
const suppliers = ref<Supplier[]>([])
const customers = ref<Customer[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

// Report tanggal sengaja TIDAK diberi default — Report Purchase & Sale
// mewajibkan user memilih range sendiri sebelum data pertama kali dimuat
// (lihat runReport's guard di bawah), beda dari list transaksi lain yang
// sudah otomatis dibatasi 30 hari terakhir.
const filters = ref({
  supplier_id: '',
  customer_id: '',
  warehouse_id: '',
  product_id: '',
  date_from: '',
  date_to: '',
})

const purchaseData = ref<any>(null)
const saleData = ref<any>(null)
const valuationData = ref<any>(null)
const mutationData = ref<any>(null)

async function loadMasters() {
  const [s, c, w, p] = await Promise.all([
    useApi<Supplier[]>('/suppliers'),
    useApi<Customer[]>('/customers'),
    useApi<Warehouse[]>('/warehouses'),
    useApi<Product[]>('/products'),
  ])
  suppliers.value = s
  customers.value = c
  warehouses.value = w
  products.value = p
}

function buildQuery(keys: string[]) {
  const params = new URLSearchParams()
  for (const k of keys) {
    const v = (filters.value as any)[k]
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function runReport() {
  errorMsg.value = ''
  if ((tab.value === 'purchase' || tab.value === 'sale') && (!filters.value.date_from || !filters.value.date_to)) {
    errorMsg.value = 'Range tanggal wajib diisi sebelum menjalankan report ini'
    return
  }
  loading.value = true
  try {
    if (tab.value === 'purchase') {
      purchaseData.value = await useApi(`/reports/purchase${buildQuery(['supplier_id', 'warehouse_id', 'product_id', 'date_from', 'date_to'])}`)
    } else if (tab.value === 'sale') {
      saleData.value = await useApi(`/reports/sale${buildQuery(['customer_id', 'warehouse_id', 'product_id', 'date_from', 'date_to'])}`)
    } else if (tab.value === 'valuation') {
      valuationData.value = await useApi(`/reports/inventory-valuation${buildQuery(['warehouse_id', 'product_id', 'date_from', 'date_to'])}`)
    } else {
      if (!filters.value.product_id) {
        errorMsg.value = 'Pilih product untuk kartu stok (mutation report wajib per product)'
        return
      }
      mutationData.value = await useApi(`/reports/mutation${buildQuery(['product_id', 'warehouse_id', 'date_from', 'date_to'])}`)
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat report'
  } finally {
    loading.value = false
  }
}

function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
async function fetchProductOptions(query: string) {
  const res = await useApiEnvelope<Product[]>('/products', { query: { page: 1, pageSize: 20, search: query } })
  return res.data.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function supplierName(id: string) {
  return suppliers.value.find((s) => s.id === id)?.name || id
}
function customerName(id: string) {
  return customers.value.find((c) => c.id === id)?.name || id
}
function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

// --- generic client-side table state (paginate/sort over an already-fetched array) ---
function useClientTable<T extends Record<string, any>>(source: () => T[]) {
  const page = ref(1)
  const pageSize = 20
  const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })

  const sorted = computed(() => {
    const rows = source()
    if (!sort.value.direction) return rows
    const { key, direction } = sort.value
    return [...rows].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
      return direction === 'asc' ? cmp : -cmp
    })
  })
  const paged = computed(() => sorted.value.slice((page.value - 1) * pageSize, page.value * pageSize))

  function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
    sort.value = s
    page.value = 1
  }
  function onPageChange(p: number) {
    page.value = p
  }

  return { page, pageSize, paged, totalRows: computed(() => source().length), onSortChange, onPageChange }
}

// --- CSV export ---
function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const outstandingPoTable = useClientTable(() => purchaseData.value?.outstanding_purchase_orders ?? [])
const priceHistoryTable = useClientTable(() => purchaseData.value?.price_history ?? [])
const saleLinesTable = useClientTable(() => saleData.value?.lines ?? [])
const valuationTable = useClientTable(() => valuationData.value?.snapshots ?? [])
const mutationTable = useClientTable(() => mutationData.value?.entries ?? [])

function exportOutstandingPo() {
  downloadCsv('purchase-outstanding.csv', outstandingPoTable.totalRows.value > 0
    ? (purchaseData.value.outstanding_purchase_orders as any[]).map((r) => ({
        no_po: r.no_po, supplier: supplierName(r.supplier_id), order_date: r.order_date, status: r.status,
        product: productLabel(r.product_id), qty_order: r.qty_order, qty_received: r.qty_received, remaining: r.remaining, unit_price: r.unit_price,
      }))
    : [])
}
function exportPriceHistory() {
  downloadCsv('purchase-price-history.csv', (purchaseData.value?.price_history ?? []).map((r: any) => ({
    product: productLabel(r.product_id), no_po: r.no_po, order_date: r.order_date, unit_price: r.unit_price, qty_order: r.qty_order,
  })))
}
function exportSaleLines() {
  downloadCsv('sale-lines.csv', (saleData.value?.lines ?? []).map((r: any) => ({
    no_so: r.no_so, source: `${r.source_type.toUpperCase()}${r.no_do ? ' / ' + r.no_do : ''}`, customer: customerName(r.customer_id),
    product: productLabel(r.product_id), qty: r.qty, sell_price: r.sell_price, cogs_per_unit: r.cogs_per_unit, revenue: r.revenue, cogs: r.cogs, margin: r.margin,
  })))
}
function exportValuation() {
  downloadCsv('inventory-valuation.csv', (valuationData.value?.snapshots ?? []).map((r: any) => ({
    snapshot_date: r.snapshot_date, product: productLabel(r.product_id), warehouse: warehouseName(r.warehouse_id), qty_on_hand: r.qty_on_hand, total_value: r.total_value,
  })))
}
function exportMutation() {
  downloadCsv('stock-mutation.csv', (mutationData.value?.entries ?? []).map((r: any) => ({
    date: r.transaction_date, type: r.transaction_type, qty_in: r.qty_in, qty_out: r.qty_out, hpp_used: r.hpp_used, balance_qty: r.running_balance_qty, balance_value: r.running_balance_value,
  })))
}

onMounted(loadMasters)
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Report' }, { label: 'Reports' }]" />
    <BasePageHeader title="Reports" />
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div class="tabs">
      <button :class="{ active: tab === 'purchase' }" @click="tab = 'purchase'">Purchase</button>
      <button :class="{ active: tab === 'sale' }" @click="tab = 'sale'">Sale</button>
      <button :class="{ active: tab === 'valuation' }" @click="tab = 'valuation'">Inventory Valuation</button>
      <button :class="{ active: tab === 'mutation' }" @click="tab = 'mutation'">Mutation (Kartu Stok)</button>
    </div>

    <form class="filter-form" @submit.prevent="runReport">
      <BaseSearchableSelect v-if="tab === 'purchase'" v-model="filters.supplier_id" label="Supplier" :options="suppliers.map((s) => ({ value: s.id, label: s.name }))" />
      <BaseSearchableSelect v-if="tab === 'sale'" v-model="filters.customer_id" label="Customer" :options="customers.map((c) => ({ value: c.id, label: c.name }))" />
      <BaseSearchableSelect v-model="filters.warehouse_id" label="Warehouse" :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
      <BaseAsyncSelect
        v-model="filters.product_id"
        :model-label="productLabel(filters.product_id)"
        :label="`Product ${tab === 'mutation' ? '(wajib)' : ''}`"
        placeholder="Cari produk (min. 2 huruf)..."
        :fetch-options="fetchProductOptions"
      />
      <BaseDateRangePicker
        :label="`Range Tanggal ${tab === 'purchase' || tab === 'sale' ? '(wajib dipilih)' : ''}`"
        :from="filters.date_from"
        :to="filters.date_to"
        @update:from="(v) => (filters.date_from = v)"
        @update:to="(v) => (filters.date_to = v)"
      />
      <BaseButton type="submit" :loading="loading">Run Report</BaseButton>
    </form>
    <p v-if="(tab === 'purchase' || tab === 'sale') && filters.date_from && filters.date_to" class="active-range">
      Menampilkan data: {{ formatDateRangeLabel(filters.date_from, filters.date_to) }}
    </p>

    <template v-if="tab === 'purchase' && purchaseData">
      <div class="section-header"><h2>Outstanding Purchase Orders</h2><BaseButton variant="secondary" size="sm" @click="exportOutstandingPo">Export CSV</BaseButton></div>
      <BaseDataTable
        :columns="[
          { key: 'no_po', label: 'No PO', sortable: true },
          { key: 'supplier_id', label: 'Supplier' },
          { key: 'order_date', label: 'Order Date', sortable: true },
          { key: 'status', label: 'Status' },
          { key: 'product_id', label: 'Product' },
          { key: 'qty_order', label: 'Qty Order', align: 'right' },
          { key: 'qty_received', label: 'Qty Received', align: 'right' },
          { key: 'remaining', label: 'Remaining', align: 'right' },
          { key: 'unit_price', label: 'Unit Price', align: 'right' },
        ]"
        :data="outstandingPoTable.paged.value"
        :page="outstandingPoTable.page.value"
        :page-size="outstandingPoTable.pageSize"
        :total-rows="outstandingPoTable.totalRows.value"
        :searchable="false"
        row-key="item_id"
        @sort-change="outstandingPoTable.onSortChange"
        @update:page="outstandingPoTable.onPageChange"
      >
        <template #cell-supplier_id="{ value }">{{ supplierName(value) }}</template>
        <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
        <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
        <template #cell-unit_price="{ value }">{{ fmt(value) }}</template>
      </BaseDataTable>

      <div class="section-header"><h2>Price History</h2><BaseButton variant="secondary" size="sm" @click="exportPriceHistory">Export CSV</BaseButton></div>
      <BaseDataTable
        :columns="[
          { key: 'product_id', label: 'Product' },
          { key: 'no_po', label: 'No PO', sortable: true },
          { key: 'order_date', label: 'Order Date', sortable: true },
          { key: 'unit_price', label: 'Unit Price', align: 'right' },
          { key: 'qty_order', label: 'Qty', align: 'right' },
        ]"
        :data="priceHistoryTable.paged.value"
        :page="priceHistoryTable.page.value"
        :page-size="priceHistoryTable.pageSize"
        :total-rows="priceHistoryTable.totalRows.value"
        :searchable="false"
        row-key="po_id"
        @sort-change="priceHistoryTable.onSortChange"
        @update:page="priceHistoryTable.onPageChange"
      >
        <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
        <template #cell-unit_price="{ value }">{{ fmt(value) }}</template>
      </BaseDataTable>
    </template>

    <template v-if="tab === 'sale' && saleData">
      <div class="summary-box">
        <div>Total Revenue: <strong>{{ fmt(saleData.summary.total_revenue) }}</strong></div>
        <div>Total COGS: <strong>{{ fmt(saleData.summary.total_cogs) }}</strong></div>
        <div>Total Margin: <strong>{{ fmt(saleData.summary.total_margin) }}</strong></div>
      </div>
      <div class="section-header"><h2>Line Detail</h2><BaseButton variant="secondary" size="sm" @click="exportSaleLines">Export CSV</BaseButton></div>
      <BaseDataTable
        :columns="[
          { key: 'no_so', label: 'No SO', sortable: true },
          { key: 'no_do', label: 'Source' },
          { key: 'customer_id', label: 'Customer' },
          { key: 'product_id', label: 'Product' },
          { key: 'qty', label: 'Qty', align: 'right' },
          { key: 'sell_price', label: 'Sell Price', align: 'right' },
          { key: 'cogs_per_unit', label: 'COGS/unit', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', sortable: true },
          { key: 'cogs', label: 'COGS', align: 'right' },
          { key: 'margin', label: 'Margin', align: 'right', sortable: true },
        ]"
        :data="saleLinesTable.paged.value"
        :page="saleLinesTable.page.value"
        :page-size="saleLinesTable.pageSize"
        :total-rows="saleLinesTable.totalRows.value"
        :searchable="false"
        row-key="so_id"
        @sort-change="saleLinesTable.onSortChange"
        @update:page="saleLinesTable.onPageChange"
      >
        <template #cell-no_do="{ row }">{{ row.source_type.toUpperCase() }}{{ row.no_do ? ' / ' + row.no_do : '' }}</template>
        <template #cell-customer_id="{ value }">{{ customerName(value) }}</template>
        <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
        <template #cell-sell_price="{ value }">{{ fmt(value) }}</template>
        <template #cell-cogs_per_unit="{ value }">{{ fmt(value) }}</template>
        <template #cell-revenue="{ value }">{{ fmt(value) }}</template>
        <template #cell-cogs="{ value }">{{ fmt(value) }}</template>
        <template #cell-margin="{ value }">{{ fmt(value) }}</template>
      </BaseDataTable>
    </template>

    <template v-if="tab === 'valuation' && valuationData">
      <p v-if="valuationData.message" class="hint">{{ valuationData.message }}</p>
      <div class="summary-box">
        <div>Total Qty On Hand: <strong>{{ fmt(valuationData.summary.total_qty_on_hand) }}</strong></div>
        <div>Total Value: <strong>{{ fmt(valuationData.summary.total_value) }}</strong></div>
      </div>
      <div class="section-header"><h2>Snapshots</h2><BaseButton variant="secondary" size="sm" @click="exportValuation">Export CSV</BaseButton></div>
      <BaseDataTable
        :columns="[
          { key: 'snapshot_date', label: 'Snapshot Date', sortable: true },
          { key: 'product_id', label: 'Product' },
          { key: 'warehouse_id', label: 'Warehouse' },
          { key: 'qty_on_hand', label: 'Qty On Hand', align: 'right' },
          { key: 'total_value', label: 'Total Value', align: 'right', sortable: true },
        ]"
        :data="valuationTable.paged.value"
        :page="valuationTable.page.value"
        :page-size="valuationTable.pageSize"
        :total-rows="valuationTable.totalRows.value"
        :searchable="false"
        @sort-change="valuationTable.onSortChange"
        @update:page="valuationTable.onPageChange"
      >
        <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
        <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
        <template #cell-total_value="{ value }">{{ fmt(value) }}</template>
      </BaseDataTable>
    </template>

    <template v-if="tab === 'mutation' && mutationData">
      <div class="summary-box">
        <div>Opening Balance: <strong>{{ mutationData.opening_balance_qty }}</strong> ({{ fmt(mutationData.opening_balance_value) }})</div>
        <div>Closing Balance: <strong>{{ mutationData.closing_balance_qty }}</strong> ({{ fmt(mutationData.closing_balance_value) }})</div>
      </div>
      <div class="section-header"><h2>Kartu Stok</h2><BaseButton variant="secondary" size="sm" @click="exportMutation">Export CSV</BaseButton></div>
      <BaseDataTable
        :columns="[
          { key: 'transaction_date', label: 'Date', sortable: true },
          { key: 'transaction_type', label: 'Type' },
          { key: 'qty_in', label: 'Qty In', align: 'right' },
          { key: 'qty_out', label: 'Qty Out', align: 'right' },
          { key: 'hpp_used', label: 'HPP Used', align: 'right' },
          { key: 'running_balance_qty', label: 'Balance Qty', align: 'right' },
          { key: 'running_balance_value', label: 'Balance Value', align: 'right' },
        ]"
        :data="mutationTable.paged.value"
        :page="mutationTable.page.value"
        :page-size="mutationTable.pageSize"
        :total-rows="mutationTable.totalRows.value"
        :searchable="false"
        @sort-change="mutationTable.onSortChange"
        @update:page="mutationTable.onPageChange"
      >
        <template #cell-transaction_date="{ value }">{{ new Date(value).toLocaleString() }}</template>
        <template #cell-hpp_used="{ value }">{{ value ?? '-' }}</template>
      </BaseDataTable>
    </template>
  </div>
</template>

<style scoped>
.hint { font-size: 13px; color: var(--color-text-muted); }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button { padding: 8px 14px; border: none; border-radius: var(--radius-sm); background: var(--color-neutral-bg); color: var(--color-text); cursor: pointer; }
.tabs button.active { background: var(--color-info); color: #fff; }
.filter-form { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; background: var(--color-surface); padding: 16px; border-radius: var(--radius-md); box-shadow: var(--elevation-1); margin-bottom: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin: 20px 0 10px; }
.section-header h2 { margin: 0; font-size: 16px; }
.summary-box { display: flex; gap: 24px; background: var(--color-surface); padding: 14px 16px; border-radius: var(--radius-md); box-shadow: var(--elevation-1); margin-bottom: 12px; font-size: 14px; }
.error { color: var(--color-danger); }
.active-range { font-size: 13px; color: var(--color-text-muted); margin: -12px 0 16px; }
</style>
