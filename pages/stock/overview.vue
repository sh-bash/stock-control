<script setup lang="ts">
interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string }

const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const tab = ref<'summary' | 'layers' | 'ledger'>('summary')
const errorMsg = ref('')

function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function productOptions() {
  return products.value.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))
}
function warehouseOptions() {
  return warehouses.value.map((w) => ({ value: w.id, label: w.name }))
}

// ============ Stock Summary tab ============
const summaryRows = ref<any[]>([])
const summaryTotal = ref(0)
const summaryLoading = ref(false)
const summaryPage = ref(1)
const summaryPageSize = 20
const summarySearch = ref('')
const summarySort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'total_value', direction: 'desc' })
const summaryWarehouseFilter = ref('')

const summaryColumns = computed(() => [
  { key: 'product_id', label: 'Product' },
  { key: 'warehouse_id', label: 'Warehouse', filterOptions: warehouseOptions() },
  { key: 'qty_on_hand', label: 'Qty On Hand', sortable: true, align: 'right' as const },
  { key: 'qty_reserved', label: 'Qty Reserved', sortable: true, align: 'right' as const },
  { key: 'qty_available', label: 'Qty Available', align: 'right' as const },
  { key: 'total_value', label: 'Total Value', sortable: true, align: 'right' as const },
])

async function loadSummary() {
  summaryLoading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(summaryPage.value), pageSize: String(summaryPageSize) })
    if (summaryWarehouseFilter.value) params.set('warehouse_id', summaryWarehouseFilter.value)
    if (summarySort.value.direction) {
      params.set('sortBy', summarySort.value.key)
      params.set('sortDir', summarySort.value.direction)
    }
    const res = await useApiEnvelope<any[]>(`/stock/summary?${params.toString()}`)
    summaryRows.value = res.data
    summaryTotal.value = Number(res.meta?.totalRows ?? res.data.length)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    summaryLoading.value = false
  }
}
function onSummaryFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'warehouse_id') {
    summaryWarehouseFilter.value = value
    summaryPage.value = 1
    loadSummary()
  }
}
function onSummarySortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  summarySort.value = s
  loadSummary()
}
function onSummaryPageChange(p: number) {
  summaryPage.value = p
  loadSummary()
}

// ============ Stock Layers tab ============
const layerRows = ref<any[]>([])
const layerTotal = ref(0)
const layerLoading = ref(false)
const layerPage = ref(1)
const layerPageSize = 20
const layerWarehouseFilter = ref('')
const layerStatusFilter = ref('')
const layerSort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'receive_date', direction: 'asc' })

const layerColumns = computed(() => [
  { key: 'product_id', label: 'Product' },
  { key: 'warehouse_id', label: 'Warehouse', filterOptions: warehouseOptions() },
  { key: 'receive_date', label: 'Receive Date', sortable: true },
  { key: 'qty_original', label: 'Qty Original', sortable: true, align: 'right' as const },
  { key: 'qty_remaining', label: 'Qty Remaining', sortable: true, align: 'right' as const },
  { key: 'hpp', label: 'HPP', sortable: true, align: 'right' as const },
  {
    key: 'status',
    label: 'Status',
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'exhausted', label: 'Exhausted' },
    ],
  },
])

async function loadLayers() {
  layerLoading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(layerPage.value), pageSize: String(layerPageSize) })
    if (layerWarehouseFilter.value) params.set('warehouse_id', layerWarehouseFilter.value)
    if (layerStatusFilter.value) params.set('status', layerStatusFilter.value)
    if (layerSort.value.direction) {
      params.set('sortBy', layerSort.value.key)
      params.set('sortDir', layerSort.value.direction)
    }
    const res = await useApiEnvelope<any[]>(`/stock/layers?${params.toString()}`)
    layerRows.value = res.data
    layerTotal.value = Number(res.meta?.totalRows ?? res.data.length)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    layerLoading.value = false
  }
}
function onLayerFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'warehouse_id') layerWarehouseFilter.value = value
  if (key === 'status') layerStatusFilter.value = value
  layerPage.value = 1
  loadLayers()
}
function onLayerSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  layerSort.value = s
  loadLayers()
}
function onLayerPageChange(p: number) {
  layerPage.value = p
  loadLayers()
}

// ============ Stock Ledger tab (append-only, potentially huge — server-side pagination is mandatory here, never load-all) ============
const ledgerRows = ref<any[]>([])
const ledgerTotal = ref(0)
const ledgerLoading = ref(false)
const ledgerPage = ref(1)
const ledgerPageSize = 20
const ledgerProductFilter = ref('')
const ledgerWarehouseFilter = ref('')
const ledgerSort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'transaction_date', direction: 'desc' })

const ledgerColumns = computed(() => [
  { key: 'product_id', label: 'Product', filterOptions: productOptions() },
  { key: 'warehouse_id', label: 'Warehouse', filterOptions: warehouseOptions() },
  { key: 'transaction_type', label: 'Type' },
  { key: 'transaction_date', label: 'Date', sortable: true },
  { key: 'qty_in', label: 'Qty In', align: 'right' as const },
  { key: 'qty_out', label: 'Qty Out', align: 'right' as const },
  { key: 'hpp_used', label: 'HPP Used', align: 'right' as const },
  { key: 'running_balance_qty', label: 'Balance Qty', align: 'right' as const },
  { key: 'running_balance_value', label: 'Balance Value', align: 'right' as const },
])

async function loadLedger() {
  ledgerLoading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(ledgerPage.value), pageSize: String(ledgerPageSize) })
    if (ledgerProductFilter.value) params.set('product_id', ledgerProductFilter.value)
    if (ledgerWarehouseFilter.value) params.set('warehouse_id', ledgerWarehouseFilter.value)
    if (ledgerSort.value.direction) {
      params.set('sortBy', ledgerSort.value.key)
      params.set('sortDir', ledgerSort.value.direction)
    }
    const res = await useApiEnvelope<any[]>(`/stock/ledger?${params.toString()}`)
    ledgerRows.value = res.data
    ledgerTotal.value = Number(res.meta?.totalRows ?? res.data.length)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    ledgerLoading.value = false
  }
}
function onLedgerFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'product_id') ledgerProductFilter.value = value
  if (key === 'warehouse_id') ledgerWarehouseFilter.value = value
  ledgerPage.value = 1
  loadLedger()
}
function onLedgerSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  ledgerSort.value = s
  loadLedger()
}
function onLedgerPageChange(p: number) {
  ledgerPage.value = p
  loadLedger()
}

function loadCurrentTab() {
  if (tab.value === 'summary') loadSummary()
  else if (tab.value === 'layers') loadLayers()
  else loadLedger()
}

// ============ Rebuild ============
const rebuilding = ref(false)
const rebuildMsg = ref('')
const showRebuildConfirm = ref(false)
async function rebuildSummary() {
  rebuilding.value = true
  rebuildMsg.value = ''
  errorMsg.value = ''
  try {
    const result = await useApi<any[]>('/stock/rebuild-summary', { method: 'POST' })
    const changed = result.filter((r: any) => r.before !== r.after).length
    rebuildMsg.value = `Rebuild selesai: ${result.length} kombinasi dicek, ${changed} berubah.`
    showRebuildConfirm.value = false
    loadCurrentTab()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal rebuild stock summary'
    showRebuildConfirm.value = false
  } finally {
    rebuilding.value = false
  }
}

onMounted(async () => {
  const [p, w] = await Promise.all([useApi<Product[]>('/products'), useApi<Warehouse[]>('/warehouses')])
  products.value = p
  warehouses.value = w
  loadSummary()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Overview' }]" />
    <BasePageHeader title="Stock Overview" :count="summaryTotal" />
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <p v-if="rebuildMsg" class="success">{{ rebuildMsg }}</p>

    <div class="tabs">
      <button :class="{ active: tab === 'summary' }" @click="tab = 'summary'; loadSummary()">Stock Summary</button>
      <button :class="{ active: tab === 'layers' }" @click="tab = 'layers'; loadLayers()">Stock Layers (FIFO)</button>
      <button :class="{ active: tab === 'ledger' }" @click="tab = 'ledger'; loadLedger()">Stock Ledger</button>
      <div class="toolbar-spacer" />
      <BaseButton variant="secondary" size="sm" @click="showRebuildConfirm = true">Rebuild Stock Summary</BaseButton>
    </div>

    <BaseDataTable
      v-if="tab === 'summary'"
      :columns="summaryColumns"
      :data="summaryRows"
      :loading="summaryLoading"
      :page="summaryPage"
      :page-size="summaryPageSize"
      :total-rows="summaryTotal"
      :searchable="false"
      @filter-change="onSummaryFilterChange"
      @sort-change="onSummarySortChange"
      @update:page="onSummaryPageChange"
    >
      <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
    </BaseDataTable>

    <BaseDataTable
      v-else-if="tab === 'layers'"
      :columns="layerColumns"
      :data="layerRows"
      :loading="layerLoading"
      :page="layerPage"
      :page-size="layerPageSize"
      :total-rows="layerTotal"
      :searchable="false"
      @filter-change="onLayerFilterChange"
      @sort-change="onLayerSortChange"
      @update:page="onLayerPageChange"
    >
      <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
    </BaseDataTable>

    <BaseDataTable
      v-else
      :columns="ledgerColumns"
      :data="ledgerRows"
      :loading="ledgerLoading"
      :page="ledgerPage"
      :page-size="ledgerPageSize"
      :total-rows="ledgerTotal"
      :searchable="false"
      @filter-change="onLedgerFilterChange"
      @sort-change="onLedgerSortChange"
      @update:page="onLedgerPageChange"
    >
      <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-transaction_date="{ value }">{{ new Date(value).toLocaleString() }}</template>
      <template #cell-hpp_used="{ value }">{{ value ?? '-' }}</template>
    </BaseDataTable>

    <BaseConfirmDialog
      v-model="showRebuildConfirm"
      title="Rebuild Stock Summary?"
      message="Menghitung ulang semua Stock Summary dari data Layers/Ledger. Pakai ini hanya bila ada kecurigaan data tidak sinkron, bukan operasi rutin."
      confirm-text="Ya, Rebuild"
      :loading="rebuilding"
      @confirm="rebuildSummary"
    />
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tabs button {
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-neutral-bg);
  color: var(--color-text);
  cursor: pointer;
}
.tabs button.active {
  background: var(--color-info);
  color: #fff;
}
.toolbar-spacer {
  flex: 1;
}
.error { color: var(--color-danger); }
.success { color: var(--color-normal); }
</style>
