<script setup lang="ts">
interface So { id: string; no_so: string; status: string }
interface DeliveryOrder { id: string; no_do: string; status: string }
interface Product { id: string; sku: string; name: string }
interface SaleReturnItem {
  id: string
  product_id: string
  qty_return: string
  restore_hpp: string | null
}
interface SaleReturn {
  id: string
  no_return: string
  source_type: string
  source_id: string
  return_date: string
  condition: string
  status: string
  items?: SaleReturnItem[]
}

const returns = ref<SaleReturn[]>([])
const saleOrders = ref<So[]>([])
const deliveryOrders = ref<DeliveryOrder[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)
const expanded = ref<Record<string, SaleReturn | null>>({})

const form = ref({
  source_type: 'do' as 'so' | 'do',
  source_id: '',
  return_date: new Date().toISOString().slice(0, 10),
  condition: 'good' as 'good' | 'damaged',
  items: [{ product_id: '', qty_return: 1 }],
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [r, so, d, p] = await Promise.all([
      useApi<SaleReturn[]>('/sale-returns'),
      useApi<So[]>('/sale-orders'),
      useApi<DeliveryOrder[]>('/delivery-orders'),
      useApi<Product[]>('/products'),
    ])
    returns.value = r.sort((a, b) => b.no_return.localeCompare(a.no_return))
    saleOrders.value = so.filter((s) => s.status === 'closed' || s.status === 'partial_delivered')
    deliveryOrders.value = d.filter((x) => x.status === 'approved')
    products.value = p
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function addItemRow() {
  form.value.items.push({ product_id: '', qty_return: 1 })
}
function removeItemRow(idx: number) {
  form.value.items.splice(idx, 1)
}

async function createReturn() {
  errorMsg.value = ''
  try {
    await useApi('/sale-returns', { method: 'POST', body: form.value })
    form.value = {
      source_type: 'do',
      source_id: '',
      return_date: new Date().toISOString().slice(0, 10),
      condition: 'good',
      items: [{ product_id: '', qty_return: 1 }],
    }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat sale return'
  }
}

async function toggleExpand(ret: SaleReturn) {
  if (expanded.value[ret.id]) {
    expanded.value[ret.id] = null
    return
  }
  const detail = await useApi<SaleReturn>(`/sale-returns/${ret.id}`)
  expanded.value[ret.id] = detail
}

function sourceLabel(ret: SaleReturn) {
  if (ret.source_type === 'do') return deliveryOrders.value.find((d) => d.id === ret.source_id)?.no_do || ret.source_id
  return saleOrders.value.find((s) => s.id === ret.source_id)?.no_so || ret.source_id
}
function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Sale Returns</h1>
    <p class="hint">
      Kondisi "good": restock dengan HPP transaksi keluar asal (bukan average sekarang). Kondisi "damaged":
      dicatat terpisah, tidak menambah stock_layers/stock_summary.
    </p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createReturn">
      <div class="row">
        <label>
          Source Type
          <select v-model="form.source_type">
            <option value="do">Delivery Order</option>
            <option value="so">Sale Order (tanpa DO)</option>
          </select>
        </label>
        <label>
          Source
          <select v-model="form.source_id" required>
            <option value="">-- pilih --</option>
            <template v-if="form.source_type === 'do'">
              <option v-for="d in deliveryOrders" :key="d.id" :value="d.id">{{ d.no_do }}</option>
            </template>
            <template v-else>
              <option v-for="s in saleOrders" :key="s.id" :value="s.id">{{ s.no_so }}</option>
            </template>
          </select>
        </label>
        <label>
          Return Date
          <input v-model="form.return_date" type="date" required />
        </label>
        <label>
          Condition
          <select v-model="form.condition">
            <option value="good">Good (restock)</option>
            <option value="damaged">Damaged (terpisah)</option>
          </select>
        </label>
      </div>

      <table class="item-table">
        <thead><tr><th>Product</th><th>Qty Return</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(item, idx) in form.items" :key="idx">
            <td>
              <select v-model="item.product_id" required>
                <option value="">-- pilih produk --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
              </select>
            </td>
            <td><input v-model.number="item.qty_return" type="number" step="any" min="0.0001" required /></td>
            <td><button type="button" class="link danger" @click="removeItemRow(idx)">Hapus</button></td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="secondary" @click="addItemRow">+ Tambah Item</button>
      <button type="submit">Buat & Proses Sale Return</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="ret-table">
      <thead><tr><th>No Return</th><th>Source</th><th>Return Date</th><th>Condition</th><th>Status</th></tr></thead>
      <tbody>
        <template v-for="ret in returns" :key="ret.id">
          <tr>
            <td><button class="link" @click="toggleExpand(ret)">{{ ret.no_return }}</button></td>
            <td>{{ ret.source_type.toUpperCase() }}: {{ sourceLabel(ret) }}</td>
            <td>{{ ret.return_date }}</td>
            <td>
              <span class="status" :class="ret.condition === 'good' ? 'status-good' : 'status-damaged'">{{ ret.condition }}</span>
            </td>
            <td><span class="status status-processed">{{ ret.status }}</span></td>
          </tr>
          <tr v-if="expanded[ret.id]">
            <td colspan="5">
              <table class="detail-table">
                <thead><tr><th>Product</th><th>Qty Return</th><th>Restore HPP</th></tr></thead>
                <tbody>
                  <tr v-for="item in expanded[ret.id]?.items" :key="item.id">
                    <td>{{ productLabel(item.product_id) }}</td>
                    <td>{{ item.qty_return }}</td>
                    <td>{{ item.restore_hpp ?? '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
        <tr v-if="returns.length === 0"><td colspan="5">Belum ada sale return</td></tr>
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
.item-table, .ret-table, .detail-table { width: 100%; border-collapse: collapse; }
.item-table th, .item-table td, .ret-table th, .ret-table td, .detail-table th, .detail-table td {
  text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;
}
.ret-table { background: #fff; border-radius: 8px; overflow: hidden; }
.detail-table { background: #f8fafc; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; align-self: flex-start; }
button.secondary { background: #94a3b8; }
button.link { background: none; color: #2563eb; padding: 2px 6px; }
button.link.danger { color: #dc2626; }
.status { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e2e8f0; }
.status-good { background: #dcfce7; color: #16a34a; }
.status-damaged { background: #fee2e2; color: #dc2626; }
.status-processed { background: #dbeafe; color: #1d4ed8; }
.error { color: #dc2626; }
</style>
