<script setup lang="ts">
interface So { id: string; no_so: string; status: string }
interface DeliveryOrder { id: string; no_do: string; status: string }
interface Product { id: string; sku: string; name: string }
interface SaleReturnItem {
  id: string
  product_id: string
  qty_return: string
  restore_hpp: string | null
}
interface SaleReturn {
  id: string
  no_return: string
  source_type: string
  source_id: string
  return_date: string
  condition: string
  status: string
  items?: SaleReturnItem[]
}

const CONDITION_OPTIONS = [
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'processed', label: 'Processed' },
]

const SOURCE_TYPE_OPTIONS = [
  { value: 'so', label: 'SO' },
  { value: 'do', label: 'DO' },
]

const rows = ref<SaleReturn[]>([])
const totalRows = ref(0)
const allSaleOrders = ref<So[]>([])
const allDeliveryOrders = ref<DeliveryOrder[]>([])
const eligibleSaleOrders = ref<So[]>([])
const eligibleDeliveryOrders = ref<DeliveryOrder[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'return_date', direction: 'desc' })

const columns = [
  { key: 'no_return', label: 'No Return', sortable: true },
  { key: 'source_id', label: 'Source' },
  { key: 'return_date', label: 'Return Date', sortable: true },
  { key: 'condition', label: 'Condition' },
  { key: 'status', label: 'Status' },
]

const { filters, setFilter, removeFilter, resetAll, activeCount } = useTableFilters(
  [
    { key: 'status', multi: true },
    { key: 'condition' },
    { key: 'source_type' },
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
  if (filters.condition) chips.push({ key: 'condition', label: `Kondisi: ${CONDITION_OPTIONS.find((o) => o.value === filters.condition)?.label}` })
  if (filters.source_type) chips.push({ key: 'source_type', label: `Source: ${filters.source_type.toUpperCase()}` })
  chips.push({ key: 'date_range', label: `Return Date: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
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
  const [so, d, p] = await Promise.all([
    useApi<So[]>('/sale-orders'),
    useApi<DeliveryOrder[]>('/delivery-orders'),
    useApi<Product[]>('/products'),
  ])
  allSaleOrders.value = so
  allDeliveryOrders.value = d
  eligibleSaleOrders.value = so.filter((s) => s.status === 'closed' || s.status === 'partial_delivered')
  eligibleDeliveryOrders.value = d.filter((x) => x.status === 'approved')
  products.value = p
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (search.value) params.set('search', search.value)
    if (filters.status.length) params.set('status', filters.status.join(','))
    if (filters.condition) params.set('condition', filters.condition)
    if (filters.source_type) params.set('source_type', filters.source_type)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<SaleReturn[]>(`/sale-returns?${params.toString()}`)
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

function sourceLabel(ret: SaleReturn) {
  if (ret.source_type === 'do') return allDeliveryOrders.value.find((d) => d.id === ret.source_id)?.no_do || ret.source_id
  return allSaleOrders.value.find((s) => s.id === ret.source_id)?.no_so || ret.source_id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
async function fetchProductOptions(query: string) {
  const res = await useApiEnvelope<Product[]>('/products', { query: { page: 1, pageSize: 20, search: query } })
  return res.data.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))
}

// --- create modal ---
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
function emptyForm() {
  return {
    source_type: 'do' as 'so' | 'do',
    source_id: '',
    return_date: new Date().toISOString().slice(0, 10),
    condition: 'good' as 'good' | 'damaged',
    items: [{ product_id: '', qty_return: null as number | null }],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}
function addItemRow() {
  form.value.items.push({ product_id: '', qty_return: null })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}

async function createReturn() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/sale-returns', { method: 'POST', body: form.value })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat sale return'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailReturn = ref<SaleReturn | null>(null)
async function openDetail(ret: SaleReturn) {
  detailReturn.value = await useApi<SaleReturn>(`/sale-returns/${ret.id}`)
  showDetailModal.value = true
}

onMounted(async () => {
  await loadMasters()
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Sale', to: '/sales/orders' }, { label: 'Sale Returns' }]" />
    <BasePageHeader title="Sale Returns" />
    <p class="hint">
      Kondisi "good": restock dengan HPP transaksi keluar asal (bukan average sekarang). Kondisi "damaged":
      dicatat terpisah, tidak menambah stock_layers/stock_summary.
    </p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect
        label="Status"
        :model-value="filters.status"
        :options="STATUS_OPTIONS"
        @update:model-value="(v) => setFilter('status', v)"
      />
      <BaseSelect
        label="Kondisi"
        :model-value="filters.condition"
        :options="CONDITION_OPTIONS"
        @update:model-value="(v) => setFilter('condition', v)"
      />
      <BaseSelect
        label="Source Type"
        :model-value="filters.source_type"
        :options="SOURCE_TYPE_OPTIONS"
        @update:model-value="(v) => setFilter('source_type', v)"
      />
      <BaseDateRangePicker
        label="Range Tanggal Retur"
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
      search-placeholder="Cari No Return..."
      @search-change="onSearchChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat Sale Return</BaseButton>
      </template>
      <template #cell-no_return="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_return }}</button>
      </template>
      <template #cell-source_id="{ row }">{{ row.source_type.toUpperCase() }}: {{ sourceLabel(row) }}</template>
      <template #cell-condition="{ value }"><BaseBadge :status="value" /></template>
      <template #cell-status="{ value }"><BaseBadge tone="info" :status="value" /></template>
      <template #actions="{ row }">
        <BaseButton variant="ghost" size="sm" @click="openDetail(row)">Detail</BaseButton>
      </template>
    </BaseDataTable>

    <BaseModal v-model="showCreateModal" title="Buat Sale Return" size="lg">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect
          v-model="form.source_type"
          label="Source Type"
          :options="[{ value: 'do', label: 'Delivery Order' }, { value: 'so', label: 'Sale Order (tanpa DO)' }]"
        />
        <BaseSelect
          v-model="form.source_id"
          label="Source"
          required
          :options="form.source_type === 'do' ? eligibleDeliveryOrders.map((d) => ({ value: d.id, label: d.no_do })) : eligibleSaleOrders.map((s) => ({ value: s.id, label: s.no_so }))"
        />
        <BaseDatePicker v-model="form.return_date" label="Return Date" required />
        <BaseSelect v-model="form.condition" label="Condition" :options="[{ value: 'good', label: 'Good (restock)' }, { value: 'damaged', label: 'Damaged (terpisah)' }]" />
      </div>

      <table class="line-items-table">
        <thead><tr><th>Product</th><th class="col-narrow">Qty Return</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td>
              <BaseAsyncSelect
                v-model="item.product_id"
                :model-label="productLabel(item.product_id)"
                :fetch-options="fetchProductOptions"
                required
              />
            </td>
            <td class="col-narrow"><BaseNumberInput v-model="item.qty_return" required /></td>
            <td><BaseButton variant="ghost" size="sm" @click="removeItemRow(idx)">Hapus</BaseButton></td>
          </tr>
        </tbody>
      </table>
      <BaseButton variant="secondary" size="sm" @click="addItemRow">+ Tambah Item</BaseButton>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" @click="createReturn">Buat &amp; Proses Sale Return</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Sale Return" size="lg">
      <div v-if="detailReturn" class="detail-body">
        <div class="detail-meta">
          <div><strong>No Return:</strong> {{ detailReturn.no_return }}</div>
          <div><strong>Source:</strong> {{ detailReturn.source_type.toUpperCase() }}: {{ sourceLabel(detailReturn) }}</div>
          <div><strong>Return Date:</strong> {{ detailReturn.return_date }}</div>
          <div><strong>Condition:</strong> <BaseBadge :status="detailReturn.condition" /></div>
          <div><strong>Status:</strong> <BaseBadge tone="info" :status="detailReturn.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Product</th><th>Qty Return</th><th>Restore HPP</th></tr></thead>
          <tbody>
            <tr v-for="item in detailReturn.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td>{{ item.qty_return }}</td>
              <td>{{ item.restore_hpp ?? '-' }}</td>
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
.hint { font-size: 13px; color: var(--color-text-muted); margin-bottom: 12px; }
.error { color: var(--color-danger); margin-bottom: 12px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; }
.link-cell { background: none; border: none; color: var(--color-info); cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline; }
.line-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.line-items-table th { text-align: left; font-size: 12px; color: var(--color-text-muted); padding: 6px 8px; }
.line-items-table td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid var(--color-neutral-bg); }
.col-narrow { width: 150px; }
.detail-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 16px; font-size: 13px; }
</style>
