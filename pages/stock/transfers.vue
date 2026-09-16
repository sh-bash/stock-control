<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }
interface Layer { id: string; product_id: string; warehouse_id: string; qty_remaining: string; hpp: string; receive_date: string; status: string }
interface TransferItem { id: string; product_id: string; stock_layer_id: string; qty: string }
interface Transfer {
  id: string
  no_transfer: string
  from_warehouse_id: string
  to_warehouse_id: string
  transfer_date: string
  status: string
  items?: TransferItem[]
}

const transfers = ref<Transfer[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const layers = ref<Layer[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, Transfer | null>>({})

const form = ref({
  from_warehouse_id: '',
  to_warehouse_id: '',
  transfer_date: new Date().toISOString().slice(0, 10),
  items: [{ product_id: '', stock_layer_id: '', qty: 1 }],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [t, w, p, l] = await Promise.all([
      useApi<Transfer[]>('/stock-transfers'),
      useApi<Warehouse[]>('/warehouses'),
      useApi<Product[]>('/products'),
      useApi<Layer[]>('/stock/layers'),
    ])
    transfers.value = t.sort((a, b) => b.no_transfer.localeCompare(a.no_transfer))
    warehouses.value = w
    products.value = p
    layers.value = l.filter((x) => x.status === 'active' && Number(x.qty_remaining) > 0)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function layersForWarehouse(warehouseId: string) {
  return layers.value.filter((l) => l.warehouse_id === warehouseId)
}

function addItemRow() {
  form.value.items.push({ product_id: '', stock_layer_id: '', qty: 1 })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}
function onLayerSelect(idx: number) {
  const layer = layers.value.find((l) => l.id === form.value.items[idx].stock_layer_id)
  if (layer) form.value.items[idx].product_id = layer.product_id
}

async function createTransfer() {
  errorMsg.value = ''
  try {
    await useApi('/stock-transfers', { method: 'POST', body: form.value })
    form.value = {
      from_warehouse_id: '',
      to_warehouse_id: '',
      transfer_date: new Date().toISOString().slice(0, 10),
      items: [{ product_id: '', stock_layer_id: '', qty: 1 }],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat transfer'
  }
}

async function toggleExpand(t: Transfer) {
  if (expanded.value[t.id]) {
    expanded.value[t.id] = null
    return
  }
  const detail = await useApi<Transfer>(`/stock-transfers/${t.id}`)
  expanded.value[t.id] = detail
}

function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function layerLabel(id: string) {
  const l = layers.value.find((x) => x.id === id)
  return l ? `${productLabel(l.product_id)} (sisa ${l.qty_remaining}, hpp ${l.hpp}, ${l.receive_date})` : id
}

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Stock Transfers</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createTransfer">
      <div class="row">
        <label>
          From Warehouse
          <select v-model="form.from_warehouse_id" required>
            <option value="">-- pilih --</option>
            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label>
          To Warehouse
          <select v-model="form.to_warehouse_id" required>
            <option value="">-- pilih --</option>
            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label>
          Transfer Date
          <input v-model="form.transfer_date" type="date" required />
        </label>
      </div>

      <table class="item-table">
        <thead><tr><th>Stock Layer (dari From Warehouse)</th><th>Qty</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td>
              <select v-model="form.items[idx].stock_layer_id" required @change="onLayerSelect(idx)">
                <option value="">-- pilih layer --</option>
                <option v-for="l in layersForWarehouse(form.from_warehouse_id)" :key="l.id" :value="l.id">
                  {{ layerLabel(l.id) }}
                </option>
              </select>
            </td>
            <td><input v-model.number="form.items[idx].qty" type="number" step="any" min="0.0001" required /></td>
            <td><button type="button" class="link danger" @click="removeItemRow(idx)">Hapus</button></td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="secondary" @click="addItemRow">+ Tambah Item</button>
      <button type="submit">Buat & Eksekusi Transfer</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="trf-table">
      <thead><tr><th>No Transfer</th><th>From</th><th>To</th><th>Transfer Date</th><th>Status</th></tr></thead>
      <tbody>
        <template v-for="t in transfers" :key="t.id">
          <tr>
            <td><button class="link" @click="toggleExpand(t)">{{ t.no_transfer }}</button></td>
            <td>{{ warehouseName(t.from_warehouse_id) }}</td>
            <td>{{ warehouseName(t.to_warehouse_id) }}</td>
            <td>{{ t.transfer_date }}</td>
            <td><span class="status" :class="`status-${t.status}`">{{ t.status }}</span></td>
          </tr>
          <tr v-if="expanded[t.id]">
            <td colspan="5">
              <table class="detail-table">
                <thead><tr><th>Product</th><th>Stock Layer</th><th>Qty</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[t.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td class="mono">{{ item.stock_layer_id.slice(0, 8) }}...</td>
                    <td>{{ item.qty }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="transfers.length === 0"><td colspan="5">Belum ada transfer</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.create-form { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
input, select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.item-table, .trf-table, .detail-table { width: 100%; border-collapse: collapse; }
.item-table th, .item-table td, .trf-table th, .trf-table td, .detail-table th, .detail-table td {
  text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;
}
.trf-table { background: #fff; border-radius: 8px; overflow: hidden; }
.detail-table { background: #f8fafc; }
.mono { font-family: monospace; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; align-self: flex-start; }
button.secondary { background: #94a3b8; }
button.link { background: none; color: #2563eb; padding: 2px 6px; }
button.link.danger { color: #dc2626; }
.status { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e2e8f0; }
.status-completed { background: #dcfce7; color: #16a34a; }
.error { color: #dc2626; }
</style>
