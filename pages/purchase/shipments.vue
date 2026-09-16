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

const shipments = ref<Shipment[]>([])
const expeditions = ref<Expedition[]>([])
const orders = ref<Po[]>([])
const products = ref<Product[]>([])
const poItemsCache = ref<Record<string, PoItem[]>>({})
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, Shipment | null>>({})

const form = ref({
  expedition_id: '',
  ship_date: new Date().toISOString().slice(0, 10),
  total_shipping_cost: 0,
  allocation_method: 'per_value' as 'per_qty' | 'per_value' | 'per_weight',
  po_ids: [] as string[],
  items: [] as { po_item_id: string; qty_shipped: number; weight?: number }[],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [s, e, o, p] = await Promise.all([
      useApi<Shipment[]>('/shipments'),
      useApi<Expedition[]>('/expeditions'),
      useApi<Po[]>('/purchase-orders'),
      useApi<Product[]>('/products'),
    ])
    shipments.value = s.sort((a, b) => b.no_shipment.localeCompare(a.no_shipment))
    expeditions.value = e
    orders.value = o.filter((po) => ['approved', 'partial_received'].includes(po.status))
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
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
      form.value.items.push({ po_item_id: item.id, qty_shipped: remaining })
    }
  } else {
    form.value.po_ids = form.value.po_ids.filter((id) => id !== poId)
    const itemIds = new Set((poItemsCache.value[poId] || []).map((i) => i.id))
    form.value.items = form.value.items.filter((i) => !itemIds.has(i.po_item_id))
  }
}

function productForPoItem(poItemId: string) {
  for (const items of Object.values(poItemsCache.value)) {
    const found = items.find((i) => i.id === poItemId)
    if (found) return productLabel(found.product_id)
  }
  return poItemId
}

async function createShipment() {
  errorMsg.value = ''
  try {
    await useApi('/shipments', { method: 'POST', body: form.value })
    form.value = {
      expedition_id: '',
      ship_date: new Date().toISOString().slice(0, 10),
      total_shipping_cost: 0,
      allocation_method: 'per_value',
      po_ids: [],
      items: [],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat shipment'
  }
}

async function toggleExpand(shp: Shipment) {
  if (expanded.value[shp.id]) {
    expanded.value[shp.id] = null
    return
  }
  const detail = await useApi<Shipment>(`/shipments/${shp.id}`)
  expanded.value[shp.id] = detail
}

function expeditionName(id: string) {
  return expeditions.value.find((e) => e.id === id)?.name || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Shipments</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createShipment">
      <div class="row">
        <label>
          Expedition
          <select v-model="form.expedition_id" required>
            <option value="">-- pilih --</option>
            <option v-for="e in expeditions" :key="e.id" :value="e.id">{{ e.name }}</option>
          </select>
        </label>
        <label>
          Ship Date
          <input v-model="form.ship_date" type="date" required />
        </label>
        <label>
          Total Shipping Cost
          <input v-model.number="form.total_shipping_cost" type="number" step="any" min="0" required />
        </label>
        <label>
          Allocation Method
          <select v-model="form.allocation_method">
            <option value="per_qty">Per Qty</option>
            <option value="per_value">Per Value</option>
            <option value="per_weight">Per Weight</option>
          </select>
        </label>
      </div>

      <div class="po-select">
        <div class="hint">Pilih PO yang mau dikirim (menu hanya menampilkan PO berstatus approved/partial_received):</div>
        <label v-for="po in orders" :key="po.id" class="po-checkbox">
          <input type="checkbox" @change="onTogglePo(po.id, ($event.target as HTMLInputElement).checked)" />
          {{ po.no_po }}
        </label>
      </div>

      <table v-if="form.items.length > 0" class="item-table">
        <thead>
          <tr>
            <th>Product (via PO item)</th><th>Qty Shipped</th>
            <th v-if="form.allocation_method === 'per_weight'">Weight</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.po_item_id">
            <td>{{ productForPoItem(item.po_item_id) }}</td>
            <td><input v-model.number="form.items[idx].qty_shipped" type="number" step="any" min="0.0001" /></td>
            <td v-if="form.allocation_method === 'per_weight'">
              <input v-model.number="form.items[idx].weight" type="number" step="any" min="0.0001" />
            </td>
          </tr>
        </tbody>
      </table>

      <button type="submit" :disabled="form.items.length === 0">Buat Shipment (auto-allocate cost)</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="shp-table">
      <thead>
        <tr><th>No Shipment</th><th>Expedition</th><th>Ship Date</th><th>Total Cost</th><th>Method</th></tr>
      </thead>
      <tbody>
        <template v-for="shp in shipments" :key="shp.id">
          <tr>
            <td><button class="link" @click="toggleExpand(shp)">{{ shp.no_shipment }}</button></td>
            <td>{{ expeditionName(shp.expedition_id) }}</td>
            <td>{{ shp.ship_date }}</td>
            <td>{{ shp.total_shipping_cost }}</td>
            <td>{{ shp.allocation_method }}</td>
          </tr>
          <tr v-if="expanded[shp.id]">
            <td colspan="5">
              <table class="detail-table">
                <thead><tr><th>PO Item ID</th><th>Qty Shipped</th><th>Weight</th><th>Allocated Cost / Unit</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[shp.id]?.items" :key="item.id">
                    <td class="mono">{{ item.po_item_id.slice(0, 8) }}...</td>
                    <td>{{ item.qty_shipped }}</td>
                    <td>{{ item.weight ?? '-' }}</td>
                    <td>{{ item.allocated_shipping_cost_per_unit }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="shipments.length === 0"><td colspan="5">Belum ada shipment</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.create-form {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.row label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.po-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hint {
  font-size: 12px;
  color: #64748b;
}
.po-checkbox {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
input, select {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.item-table, .shp-table, .detail-table {
  width: 100%;
  border-collapse: collapse;
}
.item-table th, .item-table td, .shp-table th, .shp-table td, .detail-table th, .detail-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}
.shp-table {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.detail-table {
  background: #f8fafc;
}
.mono { font-family: monospace; }
button {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  align-self: flex-start;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.link {
  background: none;
  color: #2563eb;
  padding: 2px 6px;
}
.error { color: #dc2626; }
</style>
