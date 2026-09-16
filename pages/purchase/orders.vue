<script setup lang="ts">
interface Supplier { id: string; name: string }
interface Warehouse { id: string; code: string; name: string }
interface Product { id: string; sku: string; name: string }
interface PoItem {
  id: string
  product_id: string
  qty_order: string
  unit_price: string
  qty_received: string
}
interface Po {
  id: string
  no_po: string
  supplier_id: string
  warehouse_id: string
  order_date: string
  status: string
  items?: PoItem[]
}

const orders = ref<Po[]>([])
const suppliers = ref<Supplier[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, Po | null>>({})

const form = ref({
  supplier_id: '',
  warehouse_id: '',
  order_date: new Date().toISOString().slice(0, 10),
  items: [{ product_id: '', qty_order: 1, unit_price: 0 }],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [o, s, w, p] = await Promise.all([
      useApi<Po[]>('/purchase-orders'),
      useApi<Supplier[]>('/suppliers'),
      useApi<Warehouse[]>('/warehouses'),
      useApi<Product[]>('/products'),
    ])
    orders.value = o.sort((a, b) => b.no_po.localeCompare(a.no_po))
    suppliers.value = s
    warehouses.value = w
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function addItemRow() {
  form.value.items.push({ product_id: '', qty_order: 1, unit_price: 0 })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}

async function createPo() {
  errorMsg.value = ''
  try {
    await useApi('/purchase-orders', { method: 'POST', body: form.value })
    form.value = {
      supplier_id: '',
      warehouse_id: '',
      order_date: new Date().toISOString().slice(0, 10),
      items: [{ product_id: '', qty_order: 1, unit_price: 0 }],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat PO'
  }
}

async function toggleExpand(po: Po) {
  if (expanded.value[po.id]) {
    expanded.value[po.id] = null
    return
  }
  const detail = await useApi<Po>(`/purchase-orders/${po.id}`)
  expanded.value[po.id] = detail
}

async function submitPo(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/purchase-orders/${id}/submit`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal submit PO'
  }
}
async function approvePo(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/purchase-orders/${id}/approve`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal approve PO'
  }
}
async function rejectPo(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/purchase-orders/${id}/reject`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal reject PO'
  }
}

function supplierName(id: string) {
  return suppliers.value.find((s) => s.id === id)?.name || id
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
    <h1>Purchase Orders</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createPo">
      <div class="row">
        <label>
          Supplier
          <select v-model="form.supplier_id" required>
            <option value="">-- pilih --</option>
            <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
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
      </div>

      <table class="item-table">
        <thead>
          <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td>
              <select v-model="item.product_id" required>
                <option value="">-- pilih produk --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
              </select>
            </td>
            <td><input v-model.number="item.qty_order" type="number" step="any" min="0.0001" required /></td>
            <td><input v-model.number="item.unit_price" type="number" step="any" min="0" required /></td>
            <td><button type="button" class="link danger" @click="removeItemRow(idx)">Hapus</button></td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="secondary" @click="addItemRow">+ Tambah Item</button>
      <button type="submit">Buat PO</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="po-table">
      <thead>
        <tr><th>No PO</th><th>Supplier</th><th>Warehouse</th><th>Order Date</th><th>Status</th><th>Aksi</th></tr>
      </thead>
      <tbody>
        <template v-for="po in orders" :key="po.id">
          <tr>
            <td><button class="link" @click="toggleExpand(po)">{{ po.no_po }}</button></td>
            <td>{{ supplierName(po.supplier_id) }}</td>
            <td>{{ warehouseName(po.warehouse_id) }}</td>
            <td>{{ po.order_date }}</td>
            <td><span class="status" :class="`status-${po.status}`">{{ po.status }}</span></td>
            <td>
              <button v-if="po.status === 'draft'" class="approve" @click="submitPo(po.id)">Submit</button>
              <template v-if="po.status === 'waiting_approval'">
                <button class="approve" @click="approvePo(po.id)">Approve</button>
                <button class="reject" @click="rejectPo(po.id)">Reject</button>
              </template>
            </td>
          </tr>
          <tr v-if="expanded[po.id]">
            <td colspan="6">
              <table class="detail-table">
                <thead><tr><th>Product</th><th>Qty Order</th><th>Unit Price</th><th>Qty Received</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[po.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td>{{ item.qty_order }}</td>
                    <td>{{ item.unit_price }}</td>
                    <td>{{ item.qty_received }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="orders.length === 0"><td colspan="6">Belum ada PO</td></tr>
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
input, select {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.item-table, .po-table, .detail-table {
  width: 100%;
  border-collapse: collapse;
}
.item-table th, .item-table td, .po-table th, .po-table td, .detail-table th, .detail-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}
.po-table {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.detail-table {
  background: #f8fafc;
}
button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  margin-right: 4px;
}
button.secondary {
  background: #94a3b8;
  align-self: flex-start;
}
button.link {
  background: none;
  color: #2563eb;
  padding: 2px 6px;
}
button.link.danger {
  color: #dc2626;
}
button.approve {
  background: #16a34a;
}
button.reject {
  background: #dc2626;
}
.status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: #e2e8f0;
}
.status-approved, .status-closed { background: #dcfce7; color: #16a34a; }
.status-waiting_approval, .status-partial_received { background: #fef3c7; color: #b45309; }
.status-rejected { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
