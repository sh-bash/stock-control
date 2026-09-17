<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }
interface So { id: string; no_so: string; use_do: boolean; status: string; warehouse_id: string }
interface SoItem { id: string; product_id: string; qty_order: string; qty_delivered: string }
interface DoItem {
  id: string
  so_item_id: string
  product_id: string
  qty_delivered: string
  cogs_per_unit: string | null
}
interface DeliveryOrder {
  id: string
  no_do: string
  so_id: string
  warehouse_id: string
  delivery_date: string
  status: string
  items?: DoItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
]

const rows = ref<DeliveryOrder[]>([])
const totalRows = ref(0)
const eligibleSaleOrders = ref<So[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const statusFilter = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'delivery_date', direction: 'desc' })

const columns = [
  { key: 'no_do', label: 'No DO', sortable: true },
  { key: 'so_id', label: 'SO' },
  { key: 'delivery_date', label: 'Delivery Date', sortable: true },
  { key: 'status', label: 'Status', filterOptions: STATUS_OPTIONS },
]

async function loadMasters() {
  const s = await useApi<So[]>('/sale-orders')
  eligibleSaleOrders.value = s.filter((so) => so.use_do && ['confirmed', 'partial_delivered'].includes(so.status))
  products.value = await useApi<Product[]>('/products')
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
    const res = await useApiEnvelope<DeliveryOrder[]>(`/delivery-orders?${params.toString()}`)
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

function soNo(id: string) {
  return eligibleSaleOrders.value.find((s) => s.id === id)?.no_so || id
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
    so_id: '',
    warehouse_id: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    items: [] as { so_item_id: string; product_id: string; qty_delivered: number | null }[],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  createError.value = ''
  showCreateModal.value = true
}

async function onSoChange() {
  form.value.items = []
  if (!form.value.so_id) return
  const so = await useApi<{ warehouse_id: string; items: SoItem[] }>(`/sale-orders/${form.value.so_id}`)
  form.value.warehouse_id = so.warehouse_id
  form.value.items = so.items
    .filter((i) => Number(i.qty_delivered) < Number(i.qty_order))
    .map((i) => ({
      so_item_id: i.id,
      product_id: i.product_id,
      qty_delivered: Number(i.qty_order) - Number(i.qty_delivered),
    }))
}

async function createDo() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/delivery-orders', { method: 'POST', body: form.value })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat DO'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailDo = ref<DeliveryOrder | null>(null)
async function openDetail(d: DeliveryOrder) {
  detailDo.value = await useApi<DeliveryOrder>(`/delivery-orders/${d.id}`)
  showDetailModal.value = true
}

// --- confirm action ---
const confirmState = ref<{ show: boolean; loading: boolean; run: (() => Promise<void>) | null; message: string }>({
  show: false, loading: false, run: null, message: '',
})
function askApprove(d: DeliveryOrder) {
  confirmState.value = {
    show: true,
    message: `DO ${d.no_do} akan disetujui — ini akan mengonsumsi stok FIFO dan menghitung COGS.`,
    loading: false,
    run: async () => {
      await useApi(`/delivery-orders/${d.id}/approve`, { method: 'POST' })
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
    <h1>Delivery Orders</h1>
    <p class="hint">Hanya SO dengan use_do=ya dan status confirmed/partial_delivered yang bisa dibuatkan DO.</p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="totalRows"
      search-placeholder="Cari No DO..."
      @search-change="onSearchChange"
      @filter-change="onFilterChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat DO</BaseButton>
      </template>
      <template #cell-no_do="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_do }}</button>
      </template>
      <template #cell-so_id="{ value }">{{ soNo(value) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <BaseButton variant="ghost" size="sm" @click="openDetail(row)">Detail</BaseButton>
        <BaseButton v-if="row.status === 'draft'" size="sm" @click="askApprove(row)">Approve</BaseButton>
      </template>
    </BaseDataTable>

    <BaseModal v-model="showCreateModal" title="Buat Delivery Order" size="lg">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.so_id" label="Sale Order" required :options="eligibleSaleOrders.map((so) => ({ value: so.id, label: so.no_so }))" @update:model-value="onSoChange" />
        <BaseDatePicker v-model="form.delivery_date" label="Delivery Date" required />
      </div>

      <table v-if="form.items.length > 0" class="line-items-table">
        <thead><tr><th>Product</th><th class="col-narrow">Qty Delivered</th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.so_item_id">
            <td>{{ productLabel(item.product_id) }}</td>
            <td class="col-narrow"><BaseNumberInput v-model="form.items[idx].qty_delivered" /></td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" :disabled="form.items.length === 0" @click="createDo">Buat DO</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Delivery Order" size="lg">
      <div v-if="detailDo" class="detail-body">
        <div class="detail-meta">
          <div><strong>No DO:</strong> {{ detailDo.no_do }}</div>
          <div><strong>SO:</strong> {{ soNo(detailDo.so_id) }}</div>
          <div><strong>Delivery Date:</strong> {{ detailDo.delivery_date }}</div>
          <div><strong>Status:</strong> <BaseBadge :status="detailDo.status" /></div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>Product</th><th>Qty</th><th>COGS/unit</th></tr></thead>
          <tbody>
            <tr v-for="item in detailDo.items" :key="item.id">
              <td>{{ productLabel(item.product_id) }}</td>
              <td>{{ item.qty_delivered }}</td>
              <td>{{ item.cogs_per_unit ?? '-' }}</td>
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
      title="Approve Delivery Order?"
      :message="confirmState.message"
      confirm-text="Ya, Approve"
      :loading="confirmState.loading"
      @confirm="runConfirmedAction"
    />
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
