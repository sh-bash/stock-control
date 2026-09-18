<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }
interface Layer { id: string; product_id: string; warehouse_id: string; qty_remaining: string; hpp: string; receive_date: string; status: string }
interface TransferItem { id: string; product_id: string; stock_layer_id: string; qty: string }
interface Transfer {
  id: string
  no_transfer: string
  from_warehouse_id: string
  to_warehouse_id: string
  transfer_date: string
  status: string
  items?: TransferItem[]
}

const STATUS_OPTIONS = [{ value: 'completed', label: 'Completed' }]

const rows = ref<Transfer[]>([])
const totalRows = ref(0)
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const layers = ref<Layer[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'transfer_date', direction: 'desc' })

const columns = [
  { key: 'no_transfer', label: 'No Transfer', sortable: true },
  { key: 'from_warehouse_id', label: 'From' },
  { key: 'to_warehouse_id', label: 'To' },
  { key: 'transfer_date', label: 'Transfer Date', sortable: true },
  { key: 'status', label: 'Status' },
]

const { filters, setFilter, removeFilter, resetAll, activeCount } = useTableFilters(
  [
    { key: 'status', multi: true },
    { key: 'from_warehouse_id' },
    { key: 'to_warehouse_id' },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  () => {
    page.value = 1
    load()
  },
)

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  for (const s of filters.status) {
    chips.push({ key: `status:${s}`, label: `Status: ${STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}` })
  }
  if (filters.from_warehouse_id) chips.push({ key: 'from_warehouse_id', label: `Dari: ${warehouseName(filters.from_warehouse_id)}` })
  if (filters.to_warehouse_id) chips.push({ key: 'to_warehouse_id', label: `Ke: ${warehouseName(filters.to_warehouse_id)}` })
  chips.push({ key: 'date_range', label: `Transfer Date: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
  return chips
})

function removeChip(key: string) {
  if (key.startsWith('status:')) {
    const val = key.slice('status:'.length)
    setFilter('status', filters.status.filter((s: string) => s !== val))
  } else if (key === 'date_range') {
    setFilter('date_from', defaultDateFrom())
    setFilter('date_to', defaultDateTo())
  } else {
    removeFilter(key)
  }
}

async function loadMasters() {
  const [w, p, l] = await Promise.all([
    useApi<Warehouse[]>('/warehouses'),
    useApi<Product[]>('/products'),
    useApi<Layer[]>('/stock/layers'),
  ])
  warehouses.value = w
  products.value = p
  layers.value = l.filter((x) => x.status === 'active' && Number(x.qty_remaining) > 0)
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (search.value) params.set('search', search.value)
    if (filters.status.length) params.set('status', filters.status.join(','))
    if (filters.from_warehouse_id) params.set('from_warehouse_id', filters.from_warehouse_id)
    if (filters.to_warehouse_id) params.set('to_warehouse_id', filters.to_warehouse_id)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<Transfer[]>(`/stock-transfers?${params.toString()}`)
    rows.value = res.data
    totalRows.value = Number(res.meta?.totalRows ?? res.data.length)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function onSearchChange(v: string) {
  search.value = v
  page.value = 1
  load()
}
function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  sort.value = s
  load()
}
function onPageChange(p: number) {
  page.value = p
  load()
}

function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function layerLabel(l: Layer) {
  return `${productLabel(l.product_id)} (sisa ${l.qty_remaining}, hpp ${l.hpp}, ${l.receive_date})`
}
function layerOptionsForWarehouse(warehouseId: string) {
  return layers.value.filter((l) => l.warehouse_id === warehouseId).map((l) => ({ value: l.id, label: layerLabel(l) }))
}

// --- create modal ---
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
function emptyForm() {
  return {
    from_warehouse_id: '',
    to_warehouse_id: '',
    transfer_date: new Date().toISOString().slice(0, 10),
    items: [{ product_id: '', stock_layer_id: '', qty: null as number | null }],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}
function addItemRow() {
  form.value.items.push({ product_id: '', stock_layer_id: '', qty: null })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}
function onLayerSelect(idx: number) {
  const layer = layers.value.find((l) => l.id === form.value.items[idx].stock_layer_id)
  if (layer) form.value.items[idx].product_id = layer.product_id
}

async function createTransfer() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/stock-transfers', { method: 'POST', body: form.value })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat transfer'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailTransfer = ref<Transfer | null>(null)
async function openDetail(t: Transfer) {
  detailTransfer.value = await useApi<Transfer>(`/stock-transfers/${t.id}`)
  showDetailModal.value = true
}

onMounted(async () => {
  await loadMasters()
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Transfers' }]" />
    <BasePageHeader title="Stock Transfers" />
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect
        label="Status"
        :model-value="filters.status"
        :options="STATUS_OPTIONS"
        @update:model-value="(v) => setFilter('status', v)"
      />
      <BaseSelect
        label="Dari Warehouse"
        :model-value="filters.from_warehouse_id"
        :options="warehouses.map((w) => ({ value: w.id, label: w.name }))"
        @update:model-value="(v) => setFilter('from_warehouse_id', v)"
      />
      <BaseSelect
        label="Ke Warehouse"
        :model-value="filters.to_warehouse_id"
        :options="warehouses.map((w) => ({ value: w.id, label: w.name }))"
        @update:model-value="(v) => setFilter('to_warehouse_id', v)"
      />
      <BaseDateRangePicker
        label="Range Tanggal"
        :from="filters.date_from"
        :to="filters.date_to"
        @update:from="(v) => setFilter('date_from', v)"
        @update:to="(v) => setFilter('date_to', v)"
      />
    </BaseFilterPanel>

    <BaseDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="totalRows"
      search-placeholder="Cari No Transfer..."
      @search-change="onSearchChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat Transfer</BaseButton>
      </template>
      <template #cell-no_transfer="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_transfer }}</button>
      </template>
      <template #cell-from_warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-to_warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <BaseButton variant="ghost" size="sm" @click="openDetail(row)">Detail</BaseButton>
      </template>
    </BaseDataTable>

    <BaseModal v-model="showCreateModal" title="Buat Stock Transfer" size="lg">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.from_warehouse_id" label="From Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
        <BaseSelect v-model="form.to_warehouse_id" label="To Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
        <BaseDatePicker v-model="form.transfer_date" label="Transfer Date" required />
      </div>

      <table class="line-items-table">
        <thead><tr><th>Stock Layer (dari From Warehouse)</th><th class="col-narrow">Qty</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td>
              <BaseSelect
                v-model="form.items[idx].stock_layer_id"
                :options="layerOptionsForWarehouse(form.from_warehouse_id)"
                required
                @update:model-value="onLayerSelect(idx)"
              />
            </td>
            <td class="col-narrow"><BaseNumberInput v-model="form.items[idx].qty" required /></td>
            <td><BaseButton variant="ghost" size="sm" @click="removeItemRow(idx)">Hapus</BaseButton></td>
          </tr>
        </tbody>
      </table>
      <BaseButton variant="secondary" size="sm" @click="addItemRow">+ Tambah Item</BaseButton>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" @click="createTransfer">Buat &amp; Eksekusi Transfer</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Stock Transfer" size="lg">
      <div v-if="detailTransfer" class="detail-body">
        <div class="detail-meta">
          <div><strong>No Transfer:</strong> {{ detailTransfer.no_transfer }}</div>
          <div><strong>From:</strong> {{ warehouseName(detailTransfer.from_warehouse_id) }}</div>
          <div><strong>To:</strong> {{ warehouseName(detailTransfer.to_warehouse_id) }}</div>
          <div><strong>Transfer Date:</strong> {{ detailTransfer.transfer_date }}</div>
          <div><strong>Status:</strong> <BaseBadge :status="detailTransfer.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Product</th><th>Stock Layer</th><th>Qty</th></tr></thead>
          <tbody>
            <tr v-for="item in detailTransfer.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td class="mono">{{ item.stock_layer_id.slice(0, 8) }}...</td>
              <td>{{ item.qty }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showDetailModal = false">Tutup</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.error { color: var(--color-danger); margin-bottom: 12px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; }
.link-cell { background: none; border: none; color: var(--color-info); cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline; }
.line-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.line-items-table th { text-align: left; font-size: 12px; color: var(--color-text-muted); padding: 6px 8px; }
.line-items-table td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid var(--color-neutral-bg); }
.col-narrow { width: 150px; }
.mono { font-family: monospace; }
.detail-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 16px; font-size: 13px; }
</style>
