<script setup lang="ts">
interface Expedition { id: string; name: string }
interface Po { id: string; no_po: string; status: string }
interface PoItem { id: string; po_id: string; product_id: string; qty_order: string; unit_price: string; qty_received: string }
interface Product { id: string; sku: string; name: string }
interface ShipmentItem {
  id: string
  po_item_id: string
  qty_shipped: string
  weight: string | null
  allocated_shipping_cost_per_unit: string | null
}
interface Shipment {
  id: string
  no_shipment: string
  expedition_id: string
  ship_date: string
  total_shipping_cost: string
  allocation_method: string
  status: string
  items?: ShipmentItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]

const rows = ref<Shipment[]>([])
const totalRows = ref(0)
const expeditions = ref<Expedition[]>([])
const approvedOrders = ref<Po[]>([])
const products = ref<Product[]>([])
const poItemsCache = ref<Record<string, PoItem[]>>({})
const errorMsg = ref('')
const loading = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'ship_date', direction: 'desc' })

const columns = [
  { key: 'no_shipment', label: 'No Shipment', sortable: true },
  { key: 'expedition_id', label: 'Expedition' },
  { key: 'ship_date', label: 'Ship Date', sortable: true },
  { key: 'total_shipping_cost', label: 'Total Cost', align: 'right' as const },
  { key: 'allocation_method', label: 'Method' },
  { key: 'status', label: 'Status' },
]

const { filters, setFilter, removeFilter, resetAll, activeCount } = useTableFilters(
  [
    { key: 'status', multi: true },
    { key: 'expedition_id' },
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
  if (filters.expedition_id) chips.push({ key: 'expedition_id', label: `Expedition: ${expeditionName(filters.expedition_id)}` })
  chips.push({ key: 'date_range', label: `Ship Date: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
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
  const [e, o, p] = await Promise.all([
    useApi<Expedition[]>('/expeditions'),
    useApi<Po[]>('/purchase-orders'),
    useApi<Product[]>('/products'),
  ])
  expeditions.value = e
  approvedOrders.value = o.filter((po) => ['approved', 'partial_received'].includes(po.status))
  products.value = p
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (search.value) params.set('search', search.value)
    if (filters.status.length) params.set('status', filters.status.join(','))
    if (filters.expedition_id) params.set('expedition_id', filters.expedition_id)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<Shipment[]>(`/shipments?${params.toString()}`)
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

function expeditionName(id: string) {
  return expeditions.value.find((e) => e.id === id)?.name || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function productForPoItem(poItemId: string) {
  for (const items of Object.values(poItemsCache.value)) {
    const found = items.find((i) => i.id === poItemId)
    if (found) return productLabel(found.product_id)
  }
  return poItemId
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
    expedition_id: '',
    ship_date: new Date().toISOString().slice(0, 10),
    total_shipping_cost: null as number | null,
    allocation_method: 'per_value' as 'per_qty' | 'per_value' | 'per_weight',
    po_ids: [] as string[],
    items: [] as { po_item_id: string; qty_shipped: number | null; weight: number | null }[],
  }
}
const form = ref(emptyForm())

function openCreateModal() {
  form.value = emptyForm()
  poItemsCache.value = {}
  createError.value = ''
  showCreateModal.value = true
}

async function onTogglePo(poId: string, checked: boolean) {
  if (checked) {
    form.value.po_ids.push(poId)
    if (!poItemsCache.value[poId]) {
      const po = await useApi<{ items: PoItem[] }>(`/purchase-orders/${poId}`)
      poItemsCache.value[poId] = po.items.filter((i) => Number(i.qty_received) < Number(i.qty_order))
    }
    for (const item of poItemsCache.value[poId]) {
      const remaining = Number(item.qty_order) - Number(item.qty_received)
      form.value.items.push({ po_item_id: item.id, qty_shipped: remaining, weight: null })
    }
  } else {
    form.value.po_ids = form.value.po_ids.filter((id) => id !== poId)
    const itemIds = new Set((poItemsCache.value[poId] || []).map((i) => i.id))
    form.value.items = form.value.items.filter((i) => !itemIds.has(i.po_item_id))
  }
}

async function createShipment() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/shipments', { method: 'POST', body: form.value })
    showCreateModal.value = false
    page.value = 1
    await load()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat shipment'
  } finally {
    creating.value = false
  }
}

// --- detail modal ---
const showDetailModal = ref(false)
const detailShipment = ref<Shipment | null>(null)
async function openDetail(shp: Shipment) {
  detailShipment.value = await useApi<Shipment>(`/shipments/${shp.id}`)
  showDetailModal.value = true
}

onMounted(async () => {
  await loadMasters()
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/orders' }, { label: 'Shipments' }]" />
    <BasePageHeader title="Shipments" />
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" inline @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect
        label="Status"
        :model-value="filters.status"
        :options="STATUS_OPTIONS"
        @update:model-value="(v) => setFilter('status', v)"
      />
      <BaseSearchableSelect
        label="Expedition"
        :model-value="filters.expedition_id"
        :options="expeditions.map((e) => ({ value: e.id, label: e.name }))"
        @update:model-value="(v) => setFilter('expedition_id', v)"
      />
      <BaseDateRangePicker
        label="Range Tanggal Kirim"
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
      search-placeholder="Cari No Shipment..."
      @search-change="onSearchChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="openCreateModal">+ Buat Shipment</BaseButton>
      </template>
      <template #cell-no_shipment="{ row }">
        <button class="link-cell" @click="openDetail(row)">{{ row.no_shipment }}</button>
      </template>
      <template #cell-expedition_id="{ value }">{{ expeditionName(value) }}</template>
      <template #cell-total_shipping_cost="{ value }">Rp {{ fmtCurrency(Number(value)) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <BaseButton variant="ghost" size="sm" @click="openDetail(row)">Detail</BaseButton>
      </template>
    </BaseDataTable>

    <BaseModal v-model="showCreateModal" title="Buat Shipment" size="fullscreen">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.expedition_id" label="Expedition" required :options="expeditions.map((e) => ({ value: e.id, label: e.name }))" />
        <BaseDatePicker v-model="form.ship_date" label="Ship Date" required />
        <BaseNumberInput v-model="form.total_shipping_cost" label="Total Shipping Cost" required />
        <BaseSelect
          v-model="form.allocation_method"
          label="Allocation Method"
          :options="[
            { value: 'per_qty', label: 'Per Qty' },
            { value: 'per_value', label: 'Per Value' },
            { value: 'per_weight', label: 'Per Weight' },
          ]"
        />
      </div>

      <div class="po-select">
        <div class="hint">Pilih PO yang mau dikirim (hanya PO berstatus approved/partial_received):</div>
        <label v-for="po in approvedOrders" :key="po.id" class="po-checkbox">
          <input type="checkbox" @change="onTogglePo(po.id, ($event.target as HTMLInputElement).checked)" />
          {{ po.no_po }}
        </label>
      </div>

      <table v-if="form.items.length > 0" class="line-items-table">
        <thead>
          <tr>
            <th>Product (via PO item)</th><th class="col-narrow">Qty Shipped</th>
            <th v-if="form.allocation_method === 'per_weight'" class="col-narrow">Weight</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.po_item_id">
            <td>{{ productForPoItem(item.po_item_id) }}</td>
            <td class="col-narrow"><BaseNumberInput v-model="form.items[idx].qty_shipped" /></td>
            <td v-if="form.allocation_method === 'per_weight'" class="col-narrow">
              <BaseNumberInput v-model="form.items[idx].weight" />
            </td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" :disabled="form.items.length === 0" @click="createShipment">Buat Shipment (auto-allocate cost)</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="showDetailModal" title="Detail Shipment" size="lg">
      <div v-if="detailShipment" class="detail-body">
        <div class="detail-meta">
          <div><strong>No Shipment:</strong> {{ detailShipment.no_shipment }}</div>
          <div><strong>Expedition:</strong> {{ expeditionName(detailShipment.expedition_id) }}</div>
          <div><strong>Ship Date:</strong> {{ detailShipment.ship_date }}</div>
          <div><strong>Total Cost:</strong> Rp {{ fmtCurrency(Number(detailShipment.total_shipping_cost)) }}</div>
          <div><strong>Method:</strong> {{ detailShipment.allocation_method }}</div>
        </div>
        <table class="line-items-table">
          <thead><tr><th>PO Item ID</th><th>Qty Shipped</th><th>Weight</th><th>Allocated Cost / Unit</th></tr></thead>
          <tbody>
            <tr v-for="item in detailShipment.items" :key="item.id">
              <td class="mono">{{ item.po_item_id.slice(0, 8) }}...</td>
              <td>{{ item.qty_shipped }}</td>
              <td>{{ item.weight ?? '-' }}</td>
              <td>{{ item.allocated_shipping_cost_per_unit }}</td>
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
.po-select { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.po-checkbox { font-size: 13px; display: flex; align-items: center; gap: 6px; }
.link-cell { background: none; border: none; color: var(--color-info); cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline; }
.line-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.line-items-table th { text-align: left; font-size: 12px; color: var(--color-text-muted); padding: 6px 8px; }
.line-items-table td { padding: 4px 8px; vertical-align: top; border-bottom: 1px solid var(--color-neutral-bg); }
.col-narrow { width: 150px; }
.mono { font-family: monospace; }
.detail-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 16px; font-size: 13px; }
</style>
