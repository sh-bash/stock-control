<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Shipment { id: string; no_shipment: string; status: string }
interface ShipmentItem {
  id: string
  po_item_id: string
  qty_shipped: string
  allocated_shipping_cost_per_unit: string | null
}
interface Product { id: string; sku: string; name: string }
interface ReceivingItem {
  id: string
  product_id: string
  qty_received: string
  unit_price: string
  shipping_cost_per_unit: string
  hpp: string
  stock_layer_id: string | null
}
interface Receiving {
  id: string
  no_receiving: string
  shipment_id: string
  warehouse_id: string
  receive_date: string
  status: string
  items?: ReceivingItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const rows = ref<Receiving[]>([])
const totalRows = ref(0)
const warehouses = ref<Warehouse[]>([])
const shipments = ref<Shipment[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const statusFilter = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'receive_date', direction: 'desc' })

const columns = [
  { key: 'no_receiving', label: 'No Receiving', sortable: true },
  { key: 'shipment_id', label: 'Shipment' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'receive_date', label: 'Receive Date', sortable: true },
  { key: 'status', label: 'Status', filterOptions: STATUS_OPTIONS },
]

async function loadMasters() {
  const [w, s, p] = await Promise.all([
    useApi<Warehouse[]>('/warehouses'),
    useApi<Shipment[]>('/shipments'),
    useApi<Product[]>('/products'),
  ])
  warehouses.value = w
  shipments.value = s
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
    const res = await useApiEnvelope<Receiving[]>(`/receivings?${params.toString()}`)
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

function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function shipmentNo(id: string) {
  return shipments.value.find((s) => s.id === id)?.no_shipment || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : '-'
}

// --- create modal ---
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
function emptyForm() {
  return {
    shipment_id: '',
    warehouse_id: '',
    receive_date: new Date().toISOString().slice(0, 10),
    items: [] as { shipment_item_id: string; po_item_id: string; product_id: string; qty_received: number | null }[],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}

async function onShipmentChange() {
  form.value.items = []
  if (!form.value.shipment_id) return
  const shipment = await useApi<{ items: ShipmentItem[] }>(`/shipments/${form.value.shipment_id}`)
  form.value.items = shipment.items.map((item) => ({
    shipment_item_id: item.id,
    po_item_id: item.po_item_id,
    product_id: '',
    qty_received: Number(item.qty_shipped),
  }))
}

async function createReceiving() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/receivings', { method: 'POST', body: form.value })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat receiving'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailReceiving = ref<Receiving | null>(null)
async function openDetail(rcv: Receiving) {
  detailReceiving.value = await useApi<Receiving>(`/receivings/${rcv.id}`)
  showDetailModal.value = true
}

// --- action confirm ---
const confirmState = ref<{ show: boolean; title: string; message: string; confirmText: string; variant: 'primary' | 'danger'; loading: boolean; run: (() => Promise<void>) | null }>({
  show: false, title: '', message: '', confirmText: '', variant: 'primary', loading: false, run: null,
})
function askAction(rcv: Receiving, action: 'submit' | 'approve' | 'reject') {
  const labels = {
    submit: { title: 'Submit Receiving?', message: `Receiving ${rcv.no_receiving} akan dikirim untuk persetujuan.`, confirmText: 'Ya, Submit', variant: 'primary' as const },
    approve: { title: 'Approve Receiving?', message: `Receiving ${rcv.no_receiving} akan disetujui — stok akan bertambah.`, confirmText: 'Ya, Approve', variant: 'primary' as const },
    reject: { title: 'Reject Receiving?', message: `Receiving ${rcv.no_receiving} akan ditolak.`, confirmText: 'Ya, Reject', variant: 'danger' as const },
  }[action]
  confirmState.value = {
    show: true, ...labels, loading: false,
    run: async () => {
      await useApi(`/receivings/${rcv.id}/${action}`, { method: 'POST' })
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
    <h1>Receivings</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="totalRows"
      search-placeholder="Cari No Receiving..."
      @search-change="onSearchChange"
      @filter-change="onFilterChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat Receiving</BaseButton>
      </template>
      <template #cell-no_receiving="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_receiving }}</button>
      </template>
      <template #cell-shipment_id="{ value }">{{ shipmentNo(value) }}</template>
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

    <BaseModal v-model="showCreateModal" title="Buat Receiving" size="lg">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.shipment_id" label="Shipment" required :options="shipments.map((s) => ({ value: s.id, label: s.no_shipment }))" @update:model-value="onShipmentChange" />
        <BaseSelect v-model="form.warehouse_id" label="Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
        <BaseDatePicker v-model="form.receive_date" label="Receive Date" required />
      </div>

      <table v-if="form.items.length > 0" class="line-items-table">
        <thead><tr><th>Shipment Item</th><th>Product</th><th class="col-narrow">Qty Received</th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.shipment_item_id">
            <td class="mono">{{ item.shipment_item_id.slice(0, 8) }}...</td>
            <td><BaseSelect v-model="form.items[idx].product_id" :options="products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))" required /></td>
            <td class="col-narrow"><BaseNumberInput v-model="form.items[idx].qty_received" /></td>
          </tr>
        </tbody>
      </table>
      <p class="hint">Pilih produk yang sesuai dengan item PO pada shipment ini (harus sama dengan product_id di PO item terkait).</p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" :disabled="form.items.length === 0" @click="createReceiving">Buat Receiving</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Receiving" size="lg">
      <div v-if="detailReceiving" class="detail-body">
        <div class="detail-meta">
          <div><strong>No Receiving:</strong> {{ detailReceiving.no_receiving }}</div>
          <div><strong>Shipment:</strong> {{ shipmentNo(detailReceiving.shipment_id) }}</div>
          <div><strong>Warehouse:</strong> {{ warehouseName(detailReceiving.warehouse_id) }}</div>
          <div><strong>Receive Date:</strong> {{ detailReceiving.receive_date }}</div>
          <div><strong>Status:</strong> <BaseBadge :status="detailReceiving.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Shipping/Unit</th><th>HPP</th><th>Stock Layer</th></tr></thead>
          <tbody>
            <tr v-for="item in detailReceiving.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td>{{ item.qty_received }}</td>
              <td>{{ item.unit_price }}</td>
              <td>{{ item.shipping_cost_per_unit }}</td>
              <td><strong>{{ item.hpp }}</strong></td>
              <td class="mono">{{ item.stock_layer_id ? item.stock_layer_id.slice(0, 8) + '...' : '-' }}</td>
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
.hint { font-size: 12px; color: var(--color-text-muted); margin: 8px 0 0; }
.link-cell { background: none; border: none; color: var(--color-info); cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline; }
.line-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.line-items-table th { text-align: left; font-size: 12px; color: var(--color-text-muted); padding: 6px 8px; }
.line-items-table td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid var(--color-neutral-bg); }
.col-narrow { width: 150px; }
.mono { font-family: monospace; }
.detail-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 16px; font-size: 13px; }
</style>
