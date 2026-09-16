<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }
interface AdjustmentItem { id: string; product_id: string; qty_diff: string; hpp: string | null }
interface Adjustment {
  id: string
  no_adjustment: string
  warehouse_id: string
  adjustment_date: string
  reason: string | null
  status: string
  items?: AdjustmentItem[]
}

const adjustments = ref<Adjustment[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, Adjustment | null>>({})

const form = ref({
  warehouse_id: '',
  adjustment_date: new Date().toISOString().slice(0, 10),
  reason: '',
  items: [{ product_id: '', qty_diff: 0, hpp: 0 }],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [a, w, p] = await Promise.all([
      useApi<Adjustment[]>('/stock-adjustments'),
      useApi<Warehouse[]>('/warehouses'),
      useApi<Product[]>('/products'),
    ])
    adjustments.value = a.sort((x, y) => y.no_adjustment.localeCompare(x.no_adjustment))
    warehouses.value = w
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function addItemRow() {
  form.value.items.push({ product_id: '', qty_diff: 0, hpp: 0 })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}

async function createAdjustment() {
  errorMsg.value = ''
  try {
    const items = form.value.items.map((i) => ({
      product_id: i.product_id,
      qty_diff: i.qty_diff,
      hpp: i.qty_diff > 0 ? i.hpp : undefined,
    }))
    await useApi('/stock-adjustments', { method: 'POST', body: { ...form.value, items } })
    form.value = {
      warehouse_id: '',
      adjustment_date: new Date().toISOString().slice(0, 10),
      reason: '',
      items: [{ product_id: '', qty_diff: 0, hpp: 0 }],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat adjustment'
  }
}

async function toggleExpand(a: Adjustment) {
  if (expanded.value[a.id]) {
    expanded.value[a.id] = null
    return
  }
  const detail = await useApi<Adjustment>(`/stock-adjustments/${a.id}`)
  expanded.value[a.id] = detail
}

async function submitAdjustment(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/stock-adjustments/${id}/submit`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal submit'
  }
}
async function approveAdjustment(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/stock-adjustments/${id}/approve`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal approve'
  }
}
async function rejectAdjustment(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/stock-adjustments/${id}/reject`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal reject'
  }
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
    <h1>Stock Adjustments</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createAdjustment">
      <div class="row">
        <label>
          Warehouse
          <select v-model="form.warehouse_id" required>
            <option value="">-- pilih --</option>
            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label>
          Adjustment Date
          <input v-model="form.adjustment_date" type="date" required />
        </label>
        <label>
          Reason
          <input v-model="form.reason" type="text" placeholder="mis. stock opname" />
        </label>
      </div>

      <table class="item-table">
        <thead><tr><th>Product</th><th>Qty Diff (+/-)</th><th>HPP (wajib jika positif)</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td>
              <select v-model="item.product_id" required>
                <option value="">-- pilih produk --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
              </select>
            </td>
            <td><input v-model.number="item.qty_diff" type="number" step="any" required /></td>
            <td>
              <input
                v-if="item.qty_diff > 0"
                v-model.number="item.hpp"
                type="number"
                step="any"
                min="0"
                required
              />
              <span v-else class="hint">tidak perlu (FIFO otomatis)</span>
            </td>
            <td><button type="button" class="link danger" @click="removeItemRow(idx)">Hapus</button></td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="secondary" @click="addItemRow">+ Tambah Item</button>
      <button type="submit">Buat Adjustment</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="adj-table">
      <thead><tr><th>No Adjustment</th><th>Warehouse</th><th>Date</th><th>Reason</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>
        <template v-for="a in adjustments" :key="a.id">
          <tr>
            <td><button class="link" @click="toggleExpand(a)">{{ a.no_adjustment }}</button></td>
            <td>{{ warehouseName(a.warehouse_id) }}</td>
            <td>{{ a.adjustment_date }}</td>
            <td>{{ a.reason || '-' }}</td>
            <td><span class="status" :class="`status-${a.status}`">{{ a.status }}</span></td>
            <td>
              <button v-if="a.status === 'draft'" class="approve" @click="submitAdjustment(a.id)">Submit</button>
              <template v-if="a.status === 'waiting_approval'">
                <button class="approve" @click="approveAdjustment(a.id)">Approve</button>
                <button class="reject" @click="rejectAdjustment(a.id)">Reject</button>
              </template>
            </td>
          </tr>
          <tr v-if="expanded[a.id]">
            <td colspan="6">
              <table class="detail-table">
                <thead><tr><th>Product</th><th>Qty Diff</th><th>HPP</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[a.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td>{{ item.qty_diff }}</td>
                    <td>{{ item.hpp ?? '(FIFO)' }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="adjustments.length === 0"><td colspan="6">Belum ada adjustment</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.create-form { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
input, select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.hint { font-size: 12px; color: #64748b; }
.item-table, .adj-table, .detail-table { width: 100%; border-collapse: collapse; }
.item-table th, .item-table td, .adj-table th, .adj-table td, .detail-table th, .detail-table td {
  text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;
}
.adj-table { background: #fff; border-radius: 8px; overflow: hidden; }
.detail-table { background: #f8fafc; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; align-self: flex-start; margin-right: 4px; }
button.secondary { background: #94a3b8; }
button.link { background: none; color: #2563eb; padding: 2px 6px; }
button.link.danger { color: #dc2626; }
button.approve { background: #16a34a; }
button.reject { background: #dc2626; }
.status { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e2e8f0; }
.status-approved { background: #dcfce7; color: #16a34a; }
.status-waiting_approval { background: #fef3c7; color: #b45309; }
.status-rejected { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
