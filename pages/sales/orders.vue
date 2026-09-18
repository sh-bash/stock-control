<script setup lang="ts">
interface Customer { id: string; name: string }
interface Warehouse { id: string; code: string; name: string }
interface Product { id: string; sku: string; name: string }
interface SoItem {
  id: string
  product_id: string
  qty_order: string
  sell_price: string
  qty_delivered: string
}
interface So {
  id: string
  no_so: string
  customer_id: string
  warehouse_id: string
  order_date: string
  use_do: boolean
  status: string
  items?: SoItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'partial_delivered', label: 'Partial Delivered' },
  { value: 'closed', label: 'Closed' },
]

const rows = ref<So[]>([])
const totalRows = ref(0)
const customers = ref<Customer[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'order_date', direction: 'desc' })

const columns = [
  { key: 'no_so', label: 'No SO', sortable: true },
  { key: 'customer_id', label: 'Customer' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'use_do', label: 'use_do' },
  { key: 'status', label: 'Status' },
]

const USE_DO_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'true', label: 'Ya' },
  { value: 'false', label: 'Tidak' },
]

const { filters, setFilter, removeFilter, resetAll, activeCount } = useTableFilters(
  [
    { key: 'status', multi: true },
    { key: 'customer_id' },
    { key: 'warehouse_id' },
    { key: 'use_do' },
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
  if (filters.customer_id) chips.push({ key: 'customer_id', label: `Customer: ${customerName(filters.customer_id)}` })
  if (filters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(filters.warehouse_id)}` })
  if (filters.use_do) chips.push({ key: 'use_do', label: `use_do: ${filters.use_do === 'true' ? 'Ya' : 'Tidak'}` })
  chips.push({ key: 'date_range', label: `Order Date: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
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
  const [c, w, p] = await Promise.all([
    useApi<Customer[]>('/customers'),
    useApi<Warehouse[]>('/warehouses'),
    useApi<Product[]>('/products'),
  ])
  customers.value = c
  warehouses.value = w
  products.value = p
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (search.value) params.set('search', search.value)
    if (filters.status.length) params.set('status', filters.status.join(','))
    if (filters.customer_id) params.set('customer_id', filters.customer_id)
    if (filters.warehouse_id) params.set('warehouse_id', filters.warehouse_id)
    if (filters.use_do) params.set('use_do', filters.use_do)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<So[]>(`/sale-orders?${params.toString()}`)
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

function customerName(id: string) {
  return customers.value.find((c) => c.id === id)?.name || id
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

// --- create modal ---
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
function emptyForm() {
  return {
    customer_id: '',
    warehouse_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    use_do: false,
    items: [{ product_id: '', qty_order: null as number | null, sell_price: null as number | null }],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}
function addItemRow() {
  form.value.items.push({ product_id: '', qty_order: null, sell_price: null })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}
function itemSubtotal(item: { qty_order: number | null; sell_price: number | null }) {
  return (item.qty_order ?? 0) * (item.sell_price ?? 0)
}
const formTotal = computed(() => form.value.items.reduce((sum, i) => sum + itemSubtotal(i), 0))

async function createSo() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/sale-orders', { method: 'POST', body: form.value })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat SO'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailSo = ref<So | null>(null)
async function openDetail(so: So) {
  detailSo.value = await useApi<So>(`/sale-orders/${so.id}`)
  showDetailModal.value = true
}

// --- confirm action ---
const confirmState = ref<{ show: boolean; title: string; message: string; loading: boolean; run: (() => Promise<void>) | null }>({
  show: false, title: '', message: '', loading: false, run: null,
})
function askConfirmSo(so: So) {
  confirmState.value = {
    show: true,
    title: 'Confirm Sale Order?',
    message: so.use_do
      ? `${so.no_so} akan di-confirm — stok akan direservasi (belum keluar fisik). Buat Delivery Order untuk mengeluarkan barang.`
      : `${so.no_so} akan di-confirm — stok akan langsung berkurang (FIFO) dan transaksi selesai.`,
    loading: false,
    run: async () => {
      await useApi(`/sale-orders/${so.id}/confirm`, { method: 'POST' })
      await load()
    },
  }
}
async function runConfirmedAction() {
  if (!confirmState.value.run) return
  confirmState.value.loading = true
  try {
    await confirmState.value.run()
    confirmState.value.show = false
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Aksi gagal'
    confirmState.value.show = false
  } finally {
    confirmState.value.loading = false
  }
}

onMounted(async () => {
  await loadMasters()
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Sale', to: '/sales/orders' }, { label: 'Sale Order' }]" />
    <BasePageHeader
      title="Sale Order"
      :count="totalRows"
      description="use_do=tidak: stock langsung berkurang saat confirm. use_do=ya: hanya reserved saat confirm, buat Delivery Order untuk mengeluarkan fisik."
    >
      <template #actions>
        <BaseButton @click="openCreateModal">+ Buat SO Baru</BaseButton>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect
        label="Status"
        :model-value="filters.status"
        :options="STATUS_OPTIONS"
        @update:model-value="(v) => setFilter('status', v)"
      />
      <BaseSearchableSelect
        label="Customer"
        :model-value="filters.customer_id"
        :options="customers.map((c) => ({ value: c.id, label: c.name }))"
        @update:model-value="(v) => setFilter('customer_id', v)"
      />
      <BaseSelect
        label="Warehouse"
        :model-value="filters.warehouse_id"
        :options="warehouses.map((w) => ({ value: w.id, label: w.name }))"
        @update:model-value="(v) => setFilter('warehouse_id', v)"
      />
      <BaseSelect
        label="use_do"
        :model-value="filters.use_do"
        :options="USE_DO_OPTIONS.filter((o) => o.value)"
        placeholder="Semua"
        @update:model-value="(v) => setFilter('use_do', v)"
      />
      <BaseDateRangePicker
        label="Range Tanggal Order"
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
      search-placeholder="Cari No SO..."
      empty-text="Belum ada Sale Order"
      empty-icon="🧾"
      @search-change="onSearchChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat SO</BaseButton>
      </template>
      <template #empty-action>
        <BaseButton size="sm" @click="openCreateModal">+ Buat SO Baru</BaseButton>
      </template>
      <template #cell-no_so="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_so }}</button>
      </template>
      <template #cell-customer_id="{ value }">{{ customerName(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-use_do="{ value }">{{ value ? 'Ya' : 'Tidak' }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <BaseButton variant="ghost" size="sm" @click="openDetail(row)">Detail</BaseButton>
        <BaseButton v-if="row.status === 'draft'" size="sm" @click="askConfirmSo(row)">Confirm</BaseButton>
      </template>
    </BaseDataTable>

    <BaseModal v-model="showCreateModal" title="Buat Sale Order" size="fullscreen">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.customer_id" label="Customer" required :options="customers.map((c) => ({ value: c.id, label: c.name }))" />
        <BaseSelect v-model="form.warehouse_id" label="Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
        <BaseDatePicker v-model="form.order_date" label="Order Date" required />
        <label class="checkbox-field">
          <input v-model="form.use_do" type="checkbox" />
          Pakai Delivery Order (use_do)
        </label>
      </div>

      <table class="line-items-table">
        <thead><tr><th>Produk</th><th class="col-narrow">Qty</th><th class="col-narrow">Sell Price</th><th class="col-narrow">Subtotal</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td><BaseSelect v-model="item.product_id" :options="products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))" required /></td>
            <td class="col-narrow"><BaseNumberInput v-model="item.qty_order" required /></td>
            <td class="col-narrow"><BaseNumberInput v-model="item.sell_price" required /></td>
            <td class="col-narrow subtotal-cell">Rp {{ fmtCurrency(itemSubtotal(item)) }}</td>
            <td><BaseButton variant="ghost" size="sm" @click="removeItemRow(idx)">Hapus</BaseButton></td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td colspan="3" class="total-label">Total</td><td colspan="2" class="total-value">Rp {{ fmtCurrency(formTotal) }}</td></tr>
        </tfoot>
      </table>
      <BaseButton variant="secondary" size="sm" @click="addItemRow">+ Tambah Item</BaseButton>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" @click="createSo">Buat SO</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Sale Order" size="lg">
      <div v-if="detailSo" class="detail-body">
        <div class="detail-meta">
          <div><strong>No SO:</strong> {{ detailSo.no_so }}</div>
          <div><strong>Customer:</strong> {{ customerName(detailSo.customer_id) }}</div>
          <div><strong>Warehouse:</strong> {{ warehouseName(detailSo.warehouse_id) }}</div>
          <div><strong>use_do:</strong> {{ detailSo.use_do ? 'Ya' : 'Tidak' }}</div>
          <div><strong>Status:</strong> <BaseBadge :status="detailSo.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Produk</th><th>Qty Order</th><th>Sell Price</th><th>Qty Delivered</th></tr></thead>
          <tbody>
            <tr v-for="item in detailSo.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td>{{ item.qty_order }}</td>
              <td>{{ item.sell_price }}</td>
              <td>{{ item.qty_delivered }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showDetailModal = false">Tutup</BaseButton>
      </template>
    </BaseModal>

    <BaseConfirmDialog
      v-model="confirmState.show"
      :title="confirmState.title"
      :message="confirmState.message"
      confirm-text="Ya, Confirm"
      :loading="confirmState.loading"
      @confirm="runConfirmedAction"
    />
  </div>
</template>

<style scoped>
.error { color: var(--color-danger); margin-bottom: 12px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; align-items: end; }
.checkbox-field { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.link-cell { background: none; border: none; color: var(--color-info); cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline; }
.line-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.line-items-table th { text-align: left; font-size: 12px; color: var(--color-text-muted); padding: 6px 8px; }
.line-items-table td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid var(--color-neutral-bg); }
.col-narrow { width: 150px; }
.subtotal-cell { padding-top: 12px; font-size: 13px; font-weight: 600; }
.total-label { text-align: right; font-weight: 600; padding-top: 12px; }
.total-value { font-weight: 700; padding-top: 12px; }
.detail-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 16px; font-size: 13px; }
</style>
