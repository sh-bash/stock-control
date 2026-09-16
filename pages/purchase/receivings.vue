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

const receivings = ref<Receiving[]>([])
const warehouses = ref<Warehouse[]>([])
const shipments = ref<Shipment[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, Receiving | null>>({})

const form = ref({
  shipment_id: '',
  warehouse_id: '',
  receive_date: new Date().toISOString().slice(0, 10),
  items: [] as { shipment_item_id: string; po_item_id: string; product_id: string; qty_received: number }[],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [r, w, s, p] = await Promise.all([
      useApi<Receiving[]>('/receivings'),
      useApi<Warehouse[]>('/warehouses'),
      useApi<Shipment[]>('/shipments'),
      useApi<Product[]>('/products'),
    ])
    receivings.value = r.sort((a, b) => b.no_receiving.localeCompare(a.no_receiving))
    warehouses.value = w
    shipments.value = s
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
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
  errorMsg.value = ''
  try {
    await useApi('/receivings', { method: 'POST', body: form.value })
    form.value = {
      shipment_id: '',
      warehouse_id: '',
      receive_date: new Date().toISOString().slice(0, 10),
      items: [],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat receiving'
  }
}

async function toggleExpand(rcv: Receiving) {
  if (expanded.value[rcv.id]) {
    expanded.value[rcv.id] = null
    return
  }
  const detail = await useApi<Receiving>(`/receivings/${rcv.id}`)
  expanded.value[rcv.id] = detail
}

async function submitReceiving(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/receivings/${id}/submit`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal submit receiving'
  }
}
async function approveReceiving(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/receivings/${id}/approve`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal approve receiving'
  }
}
async function rejectReceiving(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/receivings/${id}/reject`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal reject receiving'
  }
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

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Receivings</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createReceiving">
      <div class="row">
        <label>
          Shipment
          <select v-model="form.shipment_id" required @change="onShipmentChange">
            <option value="">-- pilih --</option>
            <option v-for="s in shipments" :key="s.id" :value="s.id">{{ s.no_shipment }}</option>
          </select>
        </label>
        <label>
          Warehouse
          <select v-model="form.warehouse_id" required>
            <option value="">-- pilih --</option>
            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label>
          Receive Date
          <input v-model="form.receive_date" type="date" required />
        </label>
      </div>

      <table v-if="form.items.length > 0" class="item-table">
        <thead>
          <tr><th>Shipment Item</th><th>Product</th><th>Qty Received</th></tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.shipment_item_id">
            <td class="mono">{{ item.shipment_item_id.slice(0, 8) }}...</td>
            <td>
              <select v-model="form.items[idx].product_id" required>
                <option value="">-- pilih produk --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
              </select>
            </td>
            <td><input v-model.number="form.items[idx].qty_received" type="number" step="any" min="0.0001" /></td>
          </tr>
        </tbody>
      </table>
      <p class="hint">Pilih produk yang sesuai dengan item PO pada shipment ini (harus sama dengan product_id di PO item terkait).</p>

      <button type="submit" :disabled="form.items.length === 0">Buat Receiving</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="rcv-table">
      <thead>
        <tr><th>No Receiving</th><th>Shipment</th><th>Warehouse</th><th>Receive Date</th><th>Status</th><th>Aksi</th></tr>
      </thead>
      <tbody>
        <template v-for="rcv in receivings" :key="rcv.id">
          <tr>
            <td><button class="link" @click="toggleExpand(rcv)">{{ rcv.no_receiving }}</button></td>
            <td>{{ shipmentNo(rcv.shipment_id) }}</td>
            <td>{{ warehouseName(rcv.warehouse_id) }}</td>
            <td>{{ rcv.receive_date }}</td>
            <td><span class="status" :class="`status-${rcv.status}`">{{ rcv.status }}</span></td>
            <td>
              <button v-if="rcv.status === 'draft'" class="approve" @click="submitReceiving(rcv.id)">Submit</button>
              <template v-if="rcv.status === 'waiting_approval'">
                <button class="approve" @click="approveReceiving(rcv.id)">Approve</button>
                <button class="reject" @click="rejectReceiving(rcv.id)">Reject</button>
              </template>
            </td>
          </tr>
          <tr v-if="expanded[rcv.id]">
            <td colspan="6">
              <table class="detail-table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Shipping/Unit</th><th>HPP</th><th>Stock Layer</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in expanded[rcv.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td>{{ item.qty_received }}</td>
                    <td>{{ item.unit_price }}</td>
                    <td>{{ item.shipping_cost_per_unit }}</td>
                    <td><strong>{{ item.hpp }}</strong></td>
                    <td class="mono">{{ item.stock_layer_id ? item.stock_layer_id.slice(0, 8) + '...' : '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="receivings.length === 0"><td colspan="6">Belum ada receiving</td></tr>
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
.hint {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}
input, select {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.item-table, .rcv-table, .detail-table {
  width: 100%;
  border-collapse: collapse;
}
.item-table th, .item-table td, .rcv-table th, .rcv-table td, .detail-table th, .detail-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}
.rcv-table {
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
  margin-right: 4px;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.link {
  background: none;
  color: #2563eb;
  padding: 2px 6px;
}
button.approve { background: #16a34a; }
button.reject { background: #dc2626; }
.status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: #e2e8f0;
}
.status-approved { background: #dcfce7; color: #16a34a; }
.status-waiting_approval { background: #fef3c7; color: #b45309; }
.status-rejected { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
