<script setup lang="ts">
interface Receiving { id: string; no_receiving: string; warehouse_id: string; status: string }
interface ReceivingItem { id: string; product_id: string; stock_layer_id: string | null; qty_received: string }
interface Product { id: string; sku: string; name: string }
interface ReturnItem { id: string; product_id: string; stock_layer_id: string; qty_return: string }
interface PurchaseReturn {
  id: string
  no_return: string
  receiving_id: string
  warehouse_id: string
  return_date: string
  reason: string | null
  status: string
  items?: ReturnItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const rows = ref<PurchaseReturn[]>([])
const totalRows = ref(0)
const approvedReceivings = ref<Receiving[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const statusFilter = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'return_date', direction: 'desc' })

const columns = [
  { key: 'no_return', label: 'No Return', sortable: true },
  { key: 'receiving_id', label: 'Receiving' },
  { key: 'return_date', label: 'Return Date', sortable: true },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status', filterOptions: STATUS_OPTIONS },
]

async function loadMasters() {
  const [rc, p] = await Promise.all([useApi<Receiving[]>('/receivings'), useApi<Product[]>('/products')])
  approvedReceivings.value = rc.filter((x) => x.status === 'approved')
  products.value = p
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (search.value) params.set('search', search.value)
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<PurchaseReturn[]>(`/purchase-returns?${params.toString()}`)
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
function onFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'status') {
    statusFilter.value = value
    page.value = 1
    load()
  }
}
function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  sort.value = s
  load()
}
function onPageChange(p: number) {
  page.value = p
  load()
}

function receivingNo(id: string) {
  return approvedReceivings.value.find((r) => r.id === id)?.no_receiving || id
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
    receiving_id: '',
    warehouse_id: '',
    return_date: new Date().toISOString().slice(0, 10),
    reason: '',
    items: [] as { product_id: string; stock_layer_id: string; qty_return: number | null }[],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}

async function onReceivingChange() {
  form.value.items = []
  if (!form.value.receiving_id) return
  const rcv = await useApi<{ warehouse_id: string; items: ReceivingItem[] }>(`/receivings/${form.value.receiving_id}`)
  form.value.warehouse_id = rcv.warehouse_id
  form.value.items = rcv.items
    .filter((i) => i.stock_layer_id)
    .map((i) => ({ product_id: i.product_id, stock_layer_id: i.stock_layer_id!, qty_return: null }))
}

async function createReturn() {
  createError.value = ''
  const items = form.value.items.filter((i) => (i.qty_return ?? 0) > 0)
  if (items.length === 0) {
    createError.value = 'Isi qty_return minimal untuk 1 item'
    return
  }
  creating.value = true
  try {
    await useApi('/purchase-returns', { method: 'POST', body: { ...form.value, items } })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat purchase return'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailReturn = ref<PurchaseReturn | null>(null)
async function openDetail(ret: PurchaseReturn) {
  detailReturn.value = await useApi<PurchaseReturn>(`/purchase-returns/${ret.id}`)
  showDetailModal.value = true
}

// --- action confirm ---
const confirmState = ref<{ show: boolean; title: string; message: string; confirmText: string; variant: 'primary' | 'danger'; loading: boolean; run: (() => Promise<void>) | null }>({
  show: false, title: '', message: '', confirmText: '', variant: 'primary', loading: false, run: null,
})
function askAction(ret: PurchaseReturn, action: 'submit' | 'approve' | 'reject') {
  const labels = {
    submit: { title: 'Submit Purchase Return?', message: `${ret.no_return} akan dikirim untuk persetujuan.`, confirmText: 'Ya, Submit', variant: 'primary' as const },
    approve: { title: 'Approve Purchase Return?', message: `${ret.no_return} akan disetujui — qty layer terkait akan berkurang.`, confirmText: 'Ya, Approve', variant: 'primary' as const },
    reject: { title: 'Reject Purchase Return?', message: `${ret.no_return} akan ditolak.`, confirmText: 'Ya, Reject', variant: 'danger' as const },
  }[action]
  confirmState.value = {
    show: true, ...labels, loading: false,
    run: async () => {
      await useApi(`/purchase-returns/${ret.id}/${action}`, { method: 'POST' })
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
    <h1>Purchase Returns</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="totalRows"
      search-placeholder="Cari No Return..."
      @search-change="onSearchChange"
      @filter-change="onFilterChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat Purchase Return</BaseButton>
      </template>
      <template #cell-no_return="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_return }}</button>
      </template>
      <template #cell-receiving_id="{ value }">{{ receivingNo(value) }}</template>
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

    <BaseModal v-model="showCreateModal" title="Buat Purchase Return" size="lg">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.receiving_id" label="Receiving (approved)" required :options="approvedReceivings.map((r) => ({ value: r.id, label: r.no_receiving }))" @update:model-value="onReceivingChange" />
        <BaseDatePicker v-model="form.return_date" label="Return Date" required />
        <BaseInput v-model="form.reason" label="Reason" />
      </div>

      <table v-if="form.items.length > 0" class="line-items-table">
        <thead><tr><th>Product</th><th>Stock Layer</th><th class="col-narrow">Qty Return</th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.stock_layer_id">
            <td>{{ productLabel(item.product_id) }}</td>
            <td class="mono">{{ item.stock_layer_id.slice(0, 8) }}...</td>
            <td class="col-narrow"><BaseNumberInput v-model="form.items[idx].qty_return" /></td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" :disabled="form.items.length === 0" @click="createReturn">Buat Purchase Return</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Purchase Return" size="lg">
      <div v-if="detailReturn" class="detail-body">
        <div class="detail-meta">
          <div><strong>No Return:</strong> {{ detailReturn.no_return }}</div>
          <div><strong>Receiving:</strong> {{ receivingNo(detailReturn.receiving_id) }}</div>
          <div><strong>Return Date:</strong> {{ detailReturn.return_date }}</div>
          <div><strong>Reason:</strong> {{ detailReturn.reason || '-' }}</div>
          <div><strong>Status:</strong> <BaseBadge :status="detailReturn.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Product</th><th>Stock Layer</th><th>Qty Return</th></tr></thead>
          <tbody>
            <tr v-for="item in detailReturn.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td class="mono">{{ item.stock_layer_id.slice(0, 8) }}...</td>
              <td>{{ item.qty_return }}</td>
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
