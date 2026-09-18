<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }
interface AdjustmentItem { id: string; product_id: string; qty_diff: string; hpp: string | null }
interface Adjustment {
  id: string
  no_adjustment: string
  warehouse_id: string
  adjustment_date: string
  reason: string | null
  status: string
  items?: AdjustmentItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const rows = ref<Adjustment[]>([])
const totalRows = ref(0)
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'adjustment_date', direction: 'desc' })

const columns = [
  { key: 'no_adjustment', label: 'No Adjustment', sortable: true },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'adjustment_date', label: 'Date', sortable: true },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status' },
]

const { filters, setFilter, removeFilter, resetAll, activeCount } = useTableFilters(
  [
    { key: 'status', multi: true },
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
  if (filters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(filters.warehouse_id)}` })
  chips.push({ key: 'date_range', label: `Adjustment Date: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
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
  const [w, p] = await Promise.all([useApi<Warehouse[]>('/warehouses'), useApi<Product[]>('/products')])
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
    if (filters.warehouse_id) params.set('warehouse_id', filters.warehouse_id)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<Adjustment[]>(`/stock-adjustments?${params.toString()}`)
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
    warehouse_id: '',
    adjustment_date: new Date().toISOString().slice(0, 10),
    reason: '',
    items: [{ product_id: '', qty_diff: null as number | null, hpp: null as number | null }],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}
function addItemRow() {
  form.value.items.push({ product_id: '', qty_diff: null, hpp: null })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}

async function createAdjustment() {
  createError.value = ''
  const items = form.value.items.map((i) => ({
    product_id: i.product_id,
    qty_diff: i.qty_diff,
    hpp: (i.qty_diff ?? 0) > 0 ? i.hpp : undefined,
  }))
  creating.value = true
  try {
    await useApi('/stock-adjustments', { method: 'POST', body: { ...form.value, items } })
    showCreateModal.value = false
    page.value = 1
    await load()
    useNotificationStore().pushToast({ severity: 'success', title: 'Berhasil', message: 'Stock Adjustment berhasil dibuat.' })
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat adjustment'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailAdjustment = ref<Adjustment | null>(null)
async function openDetail(a: Adjustment) {
  detailAdjustment.value = await useApi<Adjustment>(`/stock-adjustments/${a.id}`)
  showDetailModal.value = true
}

// --- confirm action (SweetAlert2 + toast, see composables/useSwal.ts) ---
const swal = useSwal()
const notif = useNotificationStore()

async function askAction(a: Adjustment, action: 'submit' | 'approve' | 'reject') {
  const messages = {
    submit: `<strong>${a.no_adjustment}</strong> akan dikirim untuk persetujuan.`,
    approve: `<strong>${a.no_adjustment}</strong> akan disetujui dan langsung mengubah stok.`,
    reject: `<strong>${a.no_adjustment}</strong> akan ditolak.`,
  }
  const confirmed =
    action === 'approve'
      ? await swal.confirmApprove(messages.approve)
      : action === 'reject'
        ? await swal.confirmReject(messages.reject)
        : await swal.confirmAction({ title: 'Submit Adjustment?', message: messages.submit, confirmText: 'Ya, Submit' })
  if (!confirmed) return

  try {
    await useApi(`/stock-adjustments/${a.id}/${action}`, { method: 'POST' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `${a.no_adjustment} berhasil di-${action}.` })
    await load()
  } catch (err: any) {
    if (action === 'approve') {
      // Approving a negative adjustment consumes stock — surface a failure
      // (e.g. insufficient stock) as a blocking dialog, not a dismissable toast.
      await swal.criticalError(err?.data?.data?.message || 'Terjadi kesalahan', 'Approve Gagal')
    } else {
      notif.pushToast({ severity: 'danger', title: 'Aksi gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
    }
  }
}

onMounted(async () => {
  await loadMasters()
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Adjustments' }]" />
    <BasePageHeader title="Stock Adjustments" />
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" inline @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect
        label="Status"
        :model-value="filters.status"
        :options="STATUS_OPTIONS"
        @update:model-value="(v) => setFilter('status', v)"
      />
      <BaseSearchableSelect
        label="Warehouse"
        :model-value="filters.warehouse_id"
        :options="warehouses.map((w) => ({ value: w.id, label: w.name }))"
        @update:model-value="(v) => setFilter('warehouse_id', v)"
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
      search-placeholder="Cari No Adjustment..."
      @search-change="onSearchChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat Adjustment</BaseButton>
      </template>
      <template #cell-no_adjustment="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_adjustment }}</button>
      </template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-reason="{ value }">{{ value || '-' }}</template>
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

    <BaseModal v-model="showCreateModal" title="Buat Stock Adjustment" size="lg">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSearchableSelect v-model="form.warehouse_id" label="Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
        <BaseDatePicker v-model="form.adjustment_date" label="Adjustment Date" required />
        <BaseInput v-model="form.reason" label="Reason" placeholder="mis. stock opname" />
      </div>

      <table class="line-items-table">
        <thead><tr><th>Product</th><th class="col-narrow">Qty Diff (+/-)</th><th class="col-narrow">HPP (wajib jika positif)</th><th></th></tr></thead>
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
            <td class="col-narrow"><BaseNumberInput v-model="item.qty_diff" allow-negative required /></td>
            <td class="col-narrow">
              <BaseNumberInput v-if="(item.qty_diff ?? 0) > 0" v-model="item.hpp" required />
              <span v-else class="hint">tidak perlu (FIFO otomatis)</span>
            </td>
            <td><BaseButton variant="ghost" size="sm" @click="removeItemRow(idx)">Hapus</BaseButton></td>
          </tr>
        </tbody>
      </table>
      <BaseButton variant="secondary" size="sm" @click="addItemRow">+ Tambah Item</BaseButton>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" @click="createAdjustment">Buat Adjustment</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Stock Adjustment" size="lg">
      <div v-if="detailAdjustment" class="detail-body">
        <div class="detail-meta">
          <div><strong>No Adjustment:</strong> {{ detailAdjustment.no_adjustment }}</div>
          <div><strong>Warehouse:</strong> {{ warehouseName(detailAdjustment.warehouse_id) }}</div>
          <div><strong>Date:</strong> {{ detailAdjustment.adjustment_date }}</div>
          <div><strong>Reason:</strong> {{ detailAdjustment.reason || '-' }}</div>
          <div><strong>Status:</strong> <BaseBadge :status="detailAdjustment.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Product</th><th>Qty Diff</th><th>HPP</th></tr></thead>
          <tbody>
            <tr v-for="item in detailAdjustment.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td>{{ item.qty_diff }}</td>
              <td>{{ item.hpp ?? '(FIFO)' }}</td>
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
.hint { font-size: 12px; color: var(--color-text-muted); }
.link-cell { background: none; border: none; color: var(--color-info); cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline; }
.line-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.line-items-table th { text-align: left; font-size: 12px; color: var(--color-text-muted); padding: 6px 8px; }
.line-items-table td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid var(--color-neutral-bg); }
.col-narrow { width: 150px; }
.detail-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 16px; font-size: 13px; }
</style>
