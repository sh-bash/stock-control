<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }
interface Row {
  product_id: string
  warehouse_id: string
  qty_on_hand: number
  oldest_layer_age_days: number | null
  avg_daily_out_qty_30d: number | null
  projected_days_to_zero: number | null
  projected_zero_date: string | null
  projection_note: string | null
  classification: string | null
}

const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const rows = ref<Row[]>([])
const selectedWarehouse = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const qs = selectedWarehouse.value ? `?warehouse_id=${selectedWarehouse.value}` : ''
    const [w, p, r] = await Promise.all([
      useApi<Warehouse[]>('/warehouses'),
      useApi<Product[]>('/products'),
      useApi<Row[]>(`/dashboard/stock-aging-projection${qs}`),
    ])
    warehouses.value = w
    products.value = p
    rows.value = r
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}

// Client-side table state — this endpoint returns the full computed
// projection array in one shot per warehouse filter (no backend
// pagination), same rationale as the Reports page.
const page = ref(1)
const pageSize = 20
const classificationFilter = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })

// BaseDataTable keys rows by a single field — product_id alone can repeat
// across warehouses, so give each row a synthetic composite id.
const rowsWithId = computed(() => rows.value.map((r) => ({ ...r, _id: `${r.product_id}:${r.warehouse_id}` })))

const filteredRows = computed(() =>
  classificationFilter.value ? rowsWithId.value.filter((r) => r.classification === classificationFilter.value) : rowsWithId.value,
)
const sortedRows = computed(() => {
  if (!sort.value.direction) return filteredRows.value
  const { key, direction } = sort.value
  return [...filteredRows.value].sort((a, b) => {
    const av = (a as any)[key]
    const bv = (b as any)[key]
    const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
    return direction === 'asc' ? cmp : -cmp
  })
})
const pagedRows = computed(() => sortedRows.value.slice((page.value - 1) * pageSize, page.value * pageSize))

const columns = [
  { key: 'product_id', label: 'Product' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'qty_on_hand', label: 'Qty On Hand', sortable: true, align: 'right' as const },
  { key: 'oldest_layer_age_days', label: 'Umur Layer Tertua (hari)', sortable: true, align: 'right' as const },
  { key: 'avg_daily_out_qty_30d', label: 'Avg Out/Hari (30d)', sortable: true, align: 'right' as const },
  { key: 'projected_days_to_zero', label: 'Proyeksi Habis' },
  {
    key: 'classification',
    label: 'Classification',
    filterOptions: [
      { value: 'fast', label: 'Fast' },
      { value: 'normal', label: 'Normal' },
      { value: 'slow', label: 'Slow' },
      { value: 'dead', label: 'Dead' },
    ],
  },
]

function onFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'classification') {
    classificationFilter.value = value
    page.value = 1
  }
}
function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  sort.value = s
  page.value = 1
}
function onPageChange(p: number) {
  page.value = p
}

onMounted(loadAll)
</script>

<template>
  <div>
    <div class="header-row">
      <BaseBreadcrumb :items="[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Stock Aging & Projection' }]" />
      <BasePageHeader title="Stock Aging & Projection" />
      <BaseSelect
        v-model="selectedWarehouse"
        placeholder="Semua Warehouse"
        :options="warehouses.map((w) => ({ value: w.id, label: w.name }))"
        @update:model-value="loadAll"
      />
    </div>
    <p class="hint">
      projected_days_to_zero = qty_on_hand / avg_daily_out_qty_30d (§6.6). Dead stock (avg = 0) tidak punya proyeksi.
    </p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseDataTable
      :columns="columns"
      :data="pagedRows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="filteredRows.length"
      :searchable="false"
      row-key="_id"
      @filter-change="onFilterChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #cell-product_id="{ value }">{{ productLabel(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-projected_days_to_zero="{ row }">
        <span v-if="row.projection_note" class="note-dead">{{ row.projection_note }}</span>
        <span v-else>{{ row.projected_days_to_zero }} hari ({{ row.projected_zero_date }})</span>
      </template>
      <template #cell-classification="{ value }"><BaseBadge :status="value ?? '-'" /></template>
    </BaseDataTable>
  </div>
</template>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
.hint { font-size: 13px; color: var(--color-text-muted); margin-bottom: 12px; }
.note-dead { color: var(--color-danger); font-size: 12px; }
.error { color: var(--color-danger); }
</style>
