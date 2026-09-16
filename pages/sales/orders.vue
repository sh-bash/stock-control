<script setup lang="ts">
interface Customer { id: string; name: string }
interface Warehouse { id: string; code: string; name: string }
interface Product { id: string; sku: string; name: string }
interface SoItem {
  id: string
  product_id: string
  qty_order: string
  sell_price: string
  qty_delivered: string
}
interface So {
  id: string
  no_so: string
  customer_id: string
  warehouse_id: string
  order_date: string
  use_do: boolean
  status: string
  items?: SoItem[]
}

const orders = ref<So[]>([])
const customers = ref<Customer[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, So | null>>({})

const form = ref({
  customer_id: '',
  warehouse_id: '',
  order_date: new Date().toISOString().slice(0, 10),
  use_do: false,
  items: [{ product_id: '', qty_order: 1, sell_price: 0 }],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [o, c, w, p] = await Promise.all([
      useApi<So[]>('/sale-orders'),
      useApi<Customer[]>('/customers'),
      useApi<Warehouse[]>('/warehouses'),
      useApi<Product[]>('/products'),
    ])
    orders.value = o.sort((a, b) => b.no_so.localeCompare(a.no_so))
    customers.value = c
    warehouses.value = w
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function addItemRow() {
  form.value.items.push({ product_id: '', qty_order: 1, sell_price: 0 })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}

async function createSo() {
  errorMsg.value = ''
  try {
    await useApi('/sale-orders', { method: 'POST', body: form.value })
    form.value = {
      customer_id: '',
      warehouse_id: '',
      order_date: new Date().toISOString().slice(0, 10),
      use_do: false,
      items: [{ product_id: '', qty_order: 1, sell_price: 0 }],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat SO'
  }
}

async function toggleExpand(so: So) {
  if (expanded.value[so.id]) {
    expanded.value[so.id] = null
    return
  }
  const detail = await useApi<So>(`/sale-orders/${so.id}`)
  expanded.value[so.id] = detail
}

async function confirmSo(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/sale-orders/${id}/confirm`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal confirm SO'
  }
}

function customerName(id: string) {
  return customers.value.find((c) => c.id === id)?.name || id
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Sale Orders</h1>
    <p class="hint">
      use_do=false: stock langsung berkurang saat confirm. use_do=true: hanya reserved saat confirm,
      buat Delivery Order untuk mengeluarkan fisik.
    </p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createSo">
      <div class="row">
        <label>
          Customer
          <select v-model="form.customer_id" required>
            <option value="">-- pilih --</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
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
          Order Date
          <input v-model="form.order_date" type="date" required />
        </label>
        <label class="checkbox-label">
          <input v-model="form.use_do" type="checkbox" />
          Pakai Delivery Order (use_do)
        </label>
      </div>

      <table class="item-table">
        <thead><tr><th>Product</th><th>Qty</th><th>Sell Price</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td>
              <select v-model="item.product_id" required>
                <option value="">-- pilih produk --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
              </select>
            </td>
            <td><input v-model.number="item.qty_order" type="number" step="any" min="0.0001" required /></td>
            <td><input v-model.number="item.sell_price" type="number" step="any" min="0" required /></td>
            <td><button type="button" class="link danger" @click="removeItemRow(idx)">Hapus</button></td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="secondary" @click="addItemRow">+ Tambah Item</button>
      <button type="submit">Buat SO</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="so-table">
      <thead>
        <tr><th>No SO</th><th>Customer</th><th>Warehouse</th><th>use_do</th><th>Status</th><th>Aksi</th></tr>
      </thead>
      <tbody>
        <template v-for="so in orders" :key="so.id">
          <tr>
            <td><button class="link" @click="toggleExpand(so)">{{ so.no_so }}</button></td>
            <td>{{ customerName(so.customer_id) }}</td>
            <td>{{ warehouseName(so.warehouse_id) }}</td>
            <td>{{ so.use_do ? 'Ya' : 'Tidak' }}</td>
            <td><span class="status" :class="`status-${so.status}`">{{ so.status }}</span></td>
            <td>
              <button v-if="so.status === 'draft'" class="approve" @click="confirmSo(so.id)">Confirm</button>
            </td>
          </tr>
          <tr v-if="expanded[so.id]">
            <td colspan="6">
              <table class="detail-table">
                <thead><tr><th>Product</th><th>Qty Order</th><th>Sell Price</th><th>Qty Delivered</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[so.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td>{{ item.qty_order }}</td>
                    <td>{{ item.sell_price }}</td>
                    <td>{{ item.qty_delivered }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="orders.length === 0"><td colspan="6">Belum ada SO</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.hint { font-size: 13px; color: #64748b; margin-bottom: 12px; }
.create-form { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.checkbox-label { flex-direction: row !important; align-items: center; gap: 6px !important; }
input, select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.item-table, .so-table, .detail-table { width: 100%; border-collapse: collapse; }
.item-table th, .item-table td, .so-table th, .so-table td, .detail-table th, .detail-table td {
  text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;
}
.so-table { background: #fff; border-radius: 8px; overflow: hidden; }
.detail-table { background: #f8fafc; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; align-self: flex-start; }
button.secondary { background: #94a3b8; }
button.link { background: none; color: #2563eb; padding: 2px 6px; }
button.link.danger { color: #dc2626; }
button.approve { background: #16a34a; }
.status { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e2e8f0; }
.status-confirmed, .status-closed { background: #dcfce7; color: #16a34a; }
.status-partial_delivered { background: #fef3c7; color: #b45309; }
.error { color: #dc2626; }
</style>
