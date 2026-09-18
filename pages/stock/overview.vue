<script setup lang="ts">
interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string }
interface Category { id: string; name: string }

const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const categories = ref<Category[]>([])
const tab = ref<'summary' | 'layers' | 'ledger'>('summary')
const errorMsg = ref('')

const CONDITION_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out of Stock' },
]

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'receiving', label: 'Receiving' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'purchase_return', label: 'Purchase Return' },
  { value: 'sale_return', label: 'Sale Return' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'adjustment', label: 'Adjustment' },
]

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

const summaryColumns = computed(() => [
  { key: 'product_id', label: 'Product' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'qty_on_hand', label: 'Qty On Hand', sortable: true, align: 'right' as const },
  { key: 'qty_reserved', label: 'Qty Reserved', sortable: true, align: 'right' as const },
  { key: 'qty_available', label: 'Qty Available', align: 'right' as const },
  { key: 'total_value', label: 'Total Value', sortable: true, align: 'right' as const },
])

const {
  filters: summaryFilters,
  setFilter: setSummaryFilter,
  removeFilter: removeSummaryFilter,
  resetAll: resetSummaryFilters,
  activeCount: summaryActiveCount,
} = useTableFilters(
  [{ key: 'warehouse_id' }, { key: 'category_id' }, { key: 'condition' }],
  () => {
    summaryPage.value = 1
    loadSummary()
  },
)

const summaryChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (summaryFilters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(summaryFilters.warehouse_id)}` })
  if (summaryFilters.category_id) {
    chips.push({ key: 'category_id', label: `Kategori: ${categories.value.find((c) => c.id === summaryFilters.category_id)?.name ?? ''}` })
  }
  if (summaryFilters.condition) {
    chips.push({ key: 'condition', label: `Kondisi: ${CONDITION_OPTIONS.find((o) => o.value === summaryFilters.condition)?.label}` })
  }
  return chips
})

async function loadSummary() {
  summaryLoading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(summaryPage.value), pageSize: String(summaryPageSize) })
    if (summaryFilters.warehouse_id) params.set('warehouse_id', summaryFilters.warehouse_id)
    if (summaryFilters.category_id) params.set('category_id', summaryFilters.category_id)
    if (summaryFilters.condition) params.set('condition', summaryFilters.condition)
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
const ledgerSort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'transaction_date', direction: 'desc' })

const ledgerColumns = computed(() => [
  { key: 'product_id', label: 'Product' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'transaction_type', label: 'Type' },
  { key: 'transaction_date', label: 'Date', sortable: true },
  { key: 'qty_in', label: 'Qty In', align: 'right' as const },
  { key: 'qty_out', label: 'Qty Out', align: 'right' as const },
  { key: 'hpp_used', label: 'HPP Used', align: 'right' as const },
  { key: 'running_balance_qty', label: 'Balance Qty', align: 'right' as const },
  { key: 'running_balance_value', label: 'Balance Value', align: 'right' as const },
])

const {
  filters: ledgerFilters,
  setFilter: setLedgerFilter,
  removeFilter: removeLedgerFilter,
  resetAll: resetLedgerFiltersRaw,
  activeCount: ledgerActiveCount,
} = useTableFilters(
  [
    { key: 'warehouse_id' },
    { key: 'product_id' },
    { key: 'transaction_type', multi: true },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  () => {
    ledgerPage.value = 1
    loadLedger()
  },
)
// Wraps the composable's reset so it restores the mandatory 30-day default
// range instead of clearing it to empty (an unbounded stock_ledger query).
function resetLedgerFilters() {
  resetLedgerFiltersRaw()
  ledgerFilters.date_from = defaultDateFrom()
  ledgerFilters.date_to = defaultDateTo()
  loadLedger()
}

const ledgerChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (ledgerFilters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(ledgerFilters.warehouse_id)}` })
  if (ledgerFilters.product_id) chips.push({ key: 'product_id', label: `Product: ${productLabel(ledgerFilters.product_id)}` })
  for (const t of ledgerFilters.transaction_type) {
    chips.push({ key: `tt:${t}`, label: `Type: ${TRANSACTION_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t}` })
  }
  chips.push({ key: 'date_range', label: `Transaction Date: ${formatDateRangeLabel(ledgerFilters.date_from, ledgerFilters.date_to)}` })
  return chips
})

function removeLedgerChip(key: string) {
  if (key.startsWith('tt:')) {
    const val = key.slice(3)
    setLedgerFilter('transaction_type', ledgerFilters.transaction_type.filter((t: string) => t !== val))
  } else if (key === 'date_range') {
    setLedgerFilter('date_from', defaultDateFrom())
    setLedgerFilter('date_to', defaultDateTo())
  } else {
    removeLedgerFilter(key)
  }
}

async function loadLedger() {
  ledgerLoading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(ledgerPage.value), pageSize: String(ledgerPageSize) })
    if (ledgerFilters.product_id) params.set('product_id', ledgerFilters.product_id)
    if (ledgerFilters.warehouse_id) params.set('warehouse_id', ledgerFilters.warehouse_id)
    if (ledgerFilters.transaction_type.length) params.set('transaction_type', ledgerFilters.transaction_type.join(','))
    params.set('date_from', ledgerFilters.date_from || defaultDateFrom())
    params.set('date_to', ledgerFilters.date_to || defaultDateTo())
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
  const [p, w, c] = await Promise.all([
    useApi<Product[]>('/products'),
    useApi<Warehouse[]>('/warehouses'),
    useApi<Category[]>('/product-categories'),
  ])
  products.value = p
  warehouses.value = w
  categories.value = c
  if (!ledgerFilters.warehouse_id && w.length > 0) ledgerFilters.warehouse_id = w[0].id
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

    <template v-if="tab === 'summary'">
      <BaseFilterPanel :chips="summaryChips" :active-count="summaryActiveCount" inline @remove-chip="removeSummaryFilter" @reset="resetSummaryFilters">
        <BaseSelect
          label="Warehouse"
          :model-value="summaryFilters.warehouse_id"
          :options="warehouseOptions()"
          @update:model-value="(v) => setSummaryFilter('warehouse_id', v)"
        />
        <BaseSelect
          label="Product Category"
          :model-value="summaryFilters.category_id"
          :options="categories.map((c) => ({ value: c.id, label: c.name }))"
          @update:model-value="(v) => setSummaryFilter('category_id', v)"
        />
        <BaseSelect
          label="Kondisi Stock"
          :model-value="summaryFilters.condition"
          :options="CONDITION_OPTIONS"
          placeholder="Semua"
          @update:model-value="(v) => setSummaryFilter('condition', v)"
        />
      </BaseFilterPanel>

      <BaseDataTable
        :columns="summaryColumns"
        :data="summaryRows"
        :loading="summaryLoading"
        :page="summaryPage"
        :page-size="summaryPageSize"
        :total-rows="summaryTotal"
        :searchable="false"
        @sort-change="onSummarySortChange"
        @update:page="onSummaryPageChange"
      >
        <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
        <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      </BaseDataTable>
    </template>

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

    <template v-else>
      <BaseFilterPanel :chips="ledgerChips" :active-count="ledgerActiveCount" @remove-chip="removeLedgerChip" @reset="resetLedgerFilters">
        <BaseSelect
          label="Warehouse"
          :model-value="ledgerFilters.warehouse_id"
          :options="warehouseOptions()"
          @update:model-value="(v) => setLedgerFilter('warehouse_id', v)"
        />
        <BaseSearchableSelect
          label="Product"
          :model-value="ledgerFilters.product_id"
          :options="productOptions()"
          @update:model-value="(v) => setLedgerFilter('product_id', v)"
        />
        <BaseMultiSelect
          label="Transaction Type"
          :model-value="ledgerFilters.transaction_type"
          :options="TRANSACTION_TYPE_OPTIONS"
          @update:model-value="(v) => setLedgerFilter('transaction_type', v)"
        />
        <BaseDateRangePicker
          label="Range Tanggal"
          :from="ledgerFilters.date_from"
          :to="ledgerFilters.date_to"
          @update:from="(v) => setLedgerFilter('date_from', v)"
          @update:to="(v) => setLedgerFilter('date_to', v)"
        />
      </BaseFilterPanel>

      <BaseDataTable
        :columns="ledgerColumns"
        :data="ledgerRows"
        :loading="ledgerLoading"
        :page="ledgerPage"
        :page-size="ledgerPageSize"
        :total-rows="ledgerTotal"
        :searchable="false"
        @sort-change="onLedgerSortChange"
        @update:page="onLedgerPageChange"
      >
      <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-transaction_date="{ value }">{{ new Date(value).toLocaleString() }}</template>
      <template #cell-hpp_used="{ value }">{{ value ?? '-' }}</template>
      </BaseDataTable>
    </template>

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
