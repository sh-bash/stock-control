<script setup lang="ts">
interface Receiving { id: string; no_receiving: string; warehouse_id: string; status: string }
interface ReceivingItem { id: string; product_id: string; stock_layer_id: string | null; qty_received: string }
interface Product { id: string; sku: string; name: string }
interface Layer { id: string; hpp: string; qty_remaining: string; receive_date: string }
interface ReturnItem { id: string; product_id: string; stock_layer_id: string; qty_return: string }
interface PurchaseReturn {
  id: string
  no_return: string
  receiving_id: string
  warehouse_id: string
  return_date: string
  reason: string | null
  status: string
  items?: ReturnItem[]
}

const returns = ref<PurchaseReturn[]>([])
const receivings = ref<Receiving[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, PurchaseReturn | null>>({})
const receivingItemsCache = ref<ReceivingItem[]>([])

const form = ref({
  receiving_id: '',
  warehouse_id: '',
  return_date: new Date().toISOString().slice(0, 10),
  reason: '',
  items: [] as { product_id: string; stock_layer_id: string; qty_return: number }[],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [r, rc, p] = await Promise.all([
      useApi<PurchaseReturn[]>('/purchase-returns'),
      useApi<Receiving[]>('/receivings'),
      useApi<Product[]>('/products'),
    ])
    returns.value = r.sort((a, b) => b.no_return.localeCompare(a.no_return))
    receivings.value = rc.filter((x) => x.status === 'approved')
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

async function onReceivingChange() {
  form.value.items = []
  if (!form.value.receiving_id) return
  const rcv = await useApi<{ warehouse_id: string; items: ReceivingItem[] }>(`/receivings/${form.value.receiving_id}`)
  form.value.warehouse_id = rcv.warehouse_id
  receivingItemsCache.value = rcv.items
  form.value.items = rcv.items
    .filter((i) => i.stock_layer_id)
    .map((i) => ({ product_id: i.product_id, stock_layer_id: i.stock_layer_id!, qty_return: 0 }))
}

async function createReturn() {
  errorMsg.value = ''
  try {
    const items = form.value.items.filter((i) => i.qty_return > 0)
    if (items.length === 0) {
      errorMsg.value = 'Isi qty_return minimal untuk 1 item'
      return
    }
    await useApi('/purchase-returns', { method: 'POST', body: { ...form.value, items } })
    form.value = {
      receiving_id: '',
      warehouse_id: '',
      return_date: new Date().toISOString().slice(0, 10),
      reason: '',
      items: [],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat purchase return'
  }
}

async function toggleExpand(ret: PurchaseReturn) {
  if (expanded.value[ret.id]) {
    expanded.value[ret.id] = null
    return
  }
  const detail = await useApi<PurchaseReturn>(`/purchase-returns/${ret.id}`)
  expanded.value[ret.id] = detail
}

async function submitReturn(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/purchase-returns/${id}/submit`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal submit'
  }
}
async function approveReturn(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/purchase-returns/${id}/approve`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal approve'
  }
}
async function rejectReturn(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/purchase-returns/${id}/reject`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal reject'
  }
}

function receivingNo(id: string) {
  return receivings.value.find((r) => r.id === id)?.no_receiving || id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Purchase Returns</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createReturn">
      <div class="row">
        <label>
          Receiving (approved)
          <select v-model="form.receiving_id" required @change="onReceivingChange">
            <option value="">-- pilih --</option>
            <option v-for="r in receivings" :key="r.id" :value="r.id">{{ r.no_receiving }}</option>
          </select>
        </label>
        <label>
          Return Date
          <input v-model="form.return_date" type="date" required />
        </label>
        <label>
          Reason
          <input v-model="form.reason" type="text" />
        </label>
      </div>

      <table v-if="form.items.length > 0" class="item-table">
        <thead><tr><th>Product</th><th>Stock Layer</th><th>Qty Return</th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="item.stock_layer_id">
            <td>{{ productLabel(item.product_id) }}</td>
            <td class="mono">{{ item.stock_layer_id.slice(0, 8) }}...</td>
            <td><input v-model.number="form.items[idx].qty_return" type="number" step="any" min="0" /></td>
          </tr>
        </tbody>
      </table>

      <button type="submit" :disabled="form.items.length === 0">Buat Purchase Return</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="ret-table">
      <thead><tr><th>No Return</th><th>Receiving</th><th>Return Date</th><th>Reason</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>
        <template v-for="ret in returns" :key="ret.id">
          <tr>
            <td><button class="link" @click="toggleExpand(ret)">{{ ret.no_return }}</button></td>
            <td>{{ receivingNo(ret.receiving_id) }}</td>
            <td>{{ ret.return_date }}</td>
            <td>{{ ret.reason || '-' }}</td>
            <td><span class="status" :class="`status-${ret.status}`">{{ ret.status }}</span></td>
            <td>
              <button v-if="ret.status === 'draft'" class="approve" @click="submitReturn(ret.id)">Submit</button>
              <template v-if="ret.status === 'waiting_approval'">
                <button class="approve" @click="approveReturn(ret.id)">Approve</button>
                <button class="reject" @click="rejectReturn(ret.id)">Reject</button>
              </template>
            </td>
          </tr>
          <tr v-if="expanded[ret.id]">
            <td colspan="6">
              <table class="detail-table">
                <thead><tr><th>Product</th><th>Stock Layer</th><th>Qty Return</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[ret.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td class="mono">{{ item.stock_layer_id.slice(0, 8) }}...</td>
                    <td>{{ item.qty_return }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="returns.length === 0"><td colspan="6">Belum ada purchase return</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.create-form { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
input, select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.item-table, .ret-table, .detail-table { width: 100%; border-collapse: collapse; }
.item-table th, .item-table td, .ret-table th, .ret-table td, .detail-table th, .detail-table td {
  text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;
}
.ret-table { background: #fff; border-radius: 8px; overflow: hidden; }
.detail-table { background: #f8fafc; }
.mono { font-family: monospace; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; align-self: flex-start; margin-right: 4px; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.link { background: none; color: #2563eb; padding: 2px 6px; }
button.approve { background: #16a34a; }
button.reject { background: #dc2626; }
.status { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e2e8f0; }
.status-approved { background: #dcfce7; color: #16a34a; }
.status-waiting_approval { background: #fef3c7; color: #b45309; }
.status-rejected { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
