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

const deliveryOrders = ref<DeliveryOrder[]>([])
const saleOrders = ref<So[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, DeliveryOrder | null>>({})

const form = ref({
  so_id: '',
  warehouse_id: '',
  delivery_date: new Date().toISOString().slice(0, 10),
  items: [] as { so_item_id: string; product_id: string; qty_delivered: number }[],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [d, s, p] = await Promise.all([
      useApi<DeliveryOrder[]>('/delivery-orders'),
      useApi<So[]>('/sale-orders'),
      useApi<Product[]>('/products'),
    ])
    deliveryOrders.value = d.sort((a, b) => b.no_do.localeCompare(a.no_do))
    saleOrders.value = s.filter((so) => so.use_do && ['confirmed', 'partial_delivered'].includes(so.status))
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
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
  errorMsg.value = ''
  try {
    await useApi('/delivery-orders', { method: 'POST', body: form.value })
    form.value = { so_id: '', warehouse_id: '', delivery_date: new Date().toISOString().slice(0, 10), items: [] }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat DO'
  }
}

async function toggleExpand(d: DeliveryOrder) {
  if (expanded.value[d.id]) {
    expanded.value[d.id] = null
    return
  }
  const detail = await useApi<DeliveryOrder>(`/delivery-orders/${d.id}`)
  expanded.value[d.id] = detail
}

async function approveDo(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/delivery-orders/${id}/approve`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal approve DO'
  }
}

function soNo(id: string) {
  return saleOrders.value.find((s) => s.id === id)?.no_so || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Delivery Orders</h1>
    <p class="hint">Hanya SO dengan use_do=true dan status confirmed/partial_delivered yang bisa dibuatkan DO.</p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createDo">
      <div class="row">
        <label>
          Sale Order
          <select v-model="form.so_id" required @change="onSoChange">
            <option value="">-- pilih --</option>
            <option v-for="so in saleOrders" :key="so.id" :value="so.id">{{ so.no_so }}</option>
          </select>
        </label>
        <label>
          Delivery Date
          <input v-model="form.delivery_date" type="date" required />
        </label>
      </div>

      <table v-if="form.items.length > 0" class="item-table">
        <thead><tr><th>Product</th><th>Qty Delivered</th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.so_item_id">
            <td>{{ productLabel(item.product_id) }}</td>
            <td><input v-model.number="form.items[idx].qty_delivered" type="number" step="any" min="0.0001" /></td>
          </tr>
        </tbody>
      </table>

      <button type="submit" :disabled="form.items.length === 0">Buat DO</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="do-table">
      <thead><tr><th>No DO</th><th>SO</th><th>Delivery Date</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>
        <template v-for="d in deliveryOrders" :key="d.id">
          <tr>
            <td><button class="link" @click="toggleExpand(d)">{{ d.no_do }}</button></td>
            <td>{{ soNo(d.so_id) }}</td>
            <td>{{ d.delivery_date }}</td>
            <td><span class="status" :class="`status-${d.status}`">{{ d.status }}</span></td>
            <td>
              <button v-if="d.status === 'draft'" class="approve" @click="approveDo(d.id)">Approve</button>
            </td>
          </tr>
          <tr v-if="expanded[d.id]">
            <td colspan="5">
              <table class="detail-table">
                <thead><tr><th>Product</th><th>Qty</th><th>COGS/unit</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[d.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td>{{ item.qty_delivered }}</td>
                    <td>{{ item.cogs_per_unit ?? '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="deliveryOrders.length === 0"><td colspan="5">Belum ada DO</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.hint { font-size: 13px; color: #64748b; margin-bottom: 12px; }
.create-form { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
input, select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.item-table, .do-table, .detail-table { width: 100%; border-collapse: collapse; }
.item-table th, .item-table td, .do-table th, .do-table td, .detail-table th, .detail-table td {
  text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;
}
.do-table { background: #fff; border-radius: 8px; overflow: hidden; }
.detail-table { background: #f8fafc; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; align-self: flex-start; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.link { background: none; color: #2563eb; padding: 2px 6px; }
button.approve { background: #16a34a; }
.status { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e2e8f0; }
.status-approved { background: #dcfce7; color: #16a34a; }
.error { color: #dc2626; }
</style>
