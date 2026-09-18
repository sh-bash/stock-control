<script setup lang="ts">
interface Supplier { id: string; name: string }
interface Warehouse { id: string; code: string; name: string }
interface Product { id: string; sku: string; name: string }
interface PoItem {
  id: string
  product_id: string
  qty_order: string
  unit_price: string
  qty_received: string
}
interface Po {
  id: string
  no_po: string
  supplier_id: string
  warehouse_id: string
  order_date: string
  status: string
  items?: PoItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'partial_received', label: 'Partial Received' },
  { value: 'closed', label: 'Closed' },
]

const rows = ref<Po[]>([])
const totalRows = ref(0)
const suppliers = ref<Supplier[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'order_date', direction: 'desc' })

const columns = [
  { key: 'no_po', label: 'No PO', sortable: true },
  { key: 'supplier_id', label: 'Supplier' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'order_date', label: 'Order Date', sortable: true },
  { key: 'status', label: 'Status' },
]

const { filters, setFilter, removeFilter, resetAll, activeCount } = useTableFilters(
  [
    { key: 'status', multi: true },
    { key: 'supplier_id' },
    { key: 'warehouse_id' },
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
  if (filters.supplier_id) chips.push({ key: 'supplier_id', label: `Supplier: ${supplierName(filters.supplier_id)}` })
  if (filters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(filters.warehouse_id)}` })
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
  const [s, w, p] = await Promise.all([
    useApi<Supplier[]>('/suppliers'),
    useApi<Warehouse[]>('/warehouses'),
    useApi<Product[]>('/products'),
  ])
  suppliers.value = s
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
    if (filters.supplier_id) params.set('supplier_id', filters.supplier_id)
    if (filters.warehouse_id) params.set('warehouse_id', filters.warehouse_id)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<Po[]>(`/purchase-orders?${params.toString()}`)
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

function supplierName(id: string) {
  return suppliers.value.find((s) => s.id === id)?.name || id
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}

// --- create modal ---
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
function emptyForm() {
  return {
    supplier_id: '',
    warehouse_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    items: [{ product_id: '', qty_order: null as number | null, unit_price: null as number | null }],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}
function addItemRow() {
  form.value.items.push({ product_id: '', qty_order: null, unit_price: null })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}
function itemSubtotal(item: { qty_order: number | null; unit_price: number | null }) {
  return (item.qty_order ?? 0) * (item.unit_price ?? 0)
}
const formTotal = computed(() => form.value.items.reduce((sum, i) => sum + itemSubtotal(i), 0))
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

async function createPo() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/purchase-orders', { method: 'POST', body: form.value })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat PO'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailPo = ref<Po | null>(null)
async function openDetail(po: Po) {
  detailPo.value = await useApi<Po>(`/purchase-orders/${po.id}`)
  showDetailModal.value = true
}

// --- action confirm dialog (submit/approve/reject share one dialog) ---
const confirmState = ref<{ show: boolean; title: string; message: string; confirmText: string; variant: 'primary' | 'danger'; loading: boolean; run: (() => Promise<void>) | null }>({
  show: false,
  title: '',
  message: '',
  confirmText: '',
  variant: 'primary',
  loading: false,
  run: null,
})

function askAction(po: Po, action: 'submit' | 'approve' | 'reject') {
  const labels = {
    submit: { title: 'Submit PO?', message: `PO ${po.no_po} akan dikirim untuk persetujuan.`, confirmText: 'Ya, Submit', variant: 'primary' as const },
    approve: { title: 'Approve PO?', message: `PO ${po.no_po} akan disetujui dan lanjut ke tahap pengiriman.`, confirmText: 'Ya, Approve', variant: 'primary' as const },
    reject: { title: 'Reject PO?', message: `PO ${po.no_po} akan ditolak.`, confirmText: 'Ya, Reject', variant: 'danger' as const },
  }[action]
  confirmState.value = {
    show: true,
    ...labels,
    loading: false,
    run: async () => {
      await useApi(`/purchase-orders/${po.id}/${action}`, { method: 'POST' })
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
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/orders' }, { label: 'Purchase Order' }]" />
    <BasePageHeader title="Purchase Order" :count="totalRows">
      <template #actions>
        <BaseButton @click="openCreateModal">+ Buat PO Baru</BaseButton>
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
        label="Supplier"
        :model-value="filters.supplier_id"
        :options="suppliers.map((s) => ({ value: s.id, label: s.name }))"
        @update:model-value="(v) => setFilter('supplier_id', v)"
      />
      <BaseSelect
        label="Warehouse"
        :model-value="filters.warehouse_id"
        :options="warehouses.map((w) => ({ value: w.id, label: w.name }))"
        @update:model-value="(v) => setFilter('warehouse_id', v)"
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
      search-placeholder="Cari No PO..."
      empty-text="Belum ada Purchase Order"
      empty-icon="🧾"
      @search-change="onSearchChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat PO</BaseButton>
      </template>
      <template #empty-action>
        <BaseButton size="sm" @click="openCreateModal">+ Buat PO Baru</BaseButton>
      </template>
      <template #cell-no_po="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_po }}</button>
      </template>
      <template #cell-supplier_id="{ value }">{{ supplierName(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <BaseButton variant="ghost" size="sm" @click="openDetail(row)">Detail</BaseButton>
        <BaseButton v-if="row.status === 'draft'" variant="secondary" size="sm" @click="askAction(row, 'submit')">Submit</BaseButton>
        <template v-if="row.status === 'waiting_approval'">
          <BaseButton size="sm" @click="askAction(row, 'approve')">Approve</BaseButton>
          <BaseButton variant="danger" size="sm" @click="askAction(row, 'reject')">Reject</BaseButton>
        </template>
      </template>
    </BaseDataTable>

    <!-- CREATE MODAL -->
    <BaseModal v-model="showCreateModal" title="Buat Purchase Order" size="fullscreen">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.supplier_id" label="Supplier" required :options="suppliers.map((s) => ({ value: s.id, label: s.name }))" />
        <BaseSelect v-model="form.warehouse_id" label="Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
        <BaseDatePicker v-model="form.order_date" label="Order Date" required />
      </div>

      <table class="line-items-table">
        <thead>
          <tr><th>Produk</th><th class="col-narrow">Qty</th><th class="col-narrow">Harga Satuan</th><th class="col-narrow">Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td><BaseSelect v-model="item.product_id" :options="products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))" required /></td>
            <td class="col-narrow"><BaseNumberInput v-model="item.qty_order" required /></td>
            <td class="col-narrow"><BaseNumberInput v-model="item.unit_price" required /></td>
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
        <BaseButton :loading="creating" @click="createPo">Buat PO</BaseButton>
      </template>
    </BaseModal>

    <!-- DETAIL MODAL -->
    <BaseModal v-model="showDetailModal" title="Detail Purchase Order" size="lg">
      <div v-if="detailPo" class="detail-body">
        <div class="detail-meta">
          <div><strong>No PO:</strong> {{ detailPo.no_po }}</div>
          <div><strong>Supplier:</strong> {{ supplierName(detailPo.supplier_id) }}</div>
          <div><strong>Warehouse:</strong> {{ warehouseName(detailPo.warehouse_id) }}</div>
          <div><strong>Order Date:</strong> {{ detailPo.order_date }}</div>
          <div><strong>Status:</strong> <BaseBadge :status="detailPo.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Produk</th><th>Qty Order</th><th>Unit Price</th><th>Qty Received</th></tr></thead>
          <tbody>
            <tr v-for="item in detailPo.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td>{{ item.qty_order }}</td>
              <td>{{ item.unit_price }}</td>
              <td>{{ item.qty_received }}</td>
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
      :confirm-text="confirmState.confirmText"
      :variant="confirmState.variant"
      :loading="confirmState.loading"
      @confirm="runConfirmedAction"
    />
  </div>
</template>

<style scoped>
.header-row {
  margin-bottom: 16px;
}
.error {
  color: var(--color-danger);
  margin-bottom: 12px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.link-cell {
  background: none;
  border: none;
  color: var(--color-info);
  cursor: pointer;
  padding: 0;
  font-size: 13px;
  text-decoration: underline;
}
.line-items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}
.line-items-table th {
  text-align: left;
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 6px 8px;
}
.line-items-table td {
  padding: 4px 8px;
  vertical-align: top;
  border-bottom: 1px solid var(--color-neutral-bg);
}
.col-narrow {
  width: 150px;
}
.subtotal-cell {
  padding-top: 12px;
  font-size: 13px;
  font-weight: 600;
}
.total-label {
  text-align: right;
  font-weight: 600;
  padding-top: 12px;
}
.total-value {
  font-weight: 700;
  padding-top: 12px;
}
.detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}
</style>
