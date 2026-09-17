<script setup lang="ts">
interface Supplier { id: string; name: string }
interface Customer { id: string; name: string }
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }

const tab = ref<'purchase' | 'sale' | 'valuation' | 'mutation'>('purchase')
const suppliers = ref<Supplier[]>([])
const customers = ref<Customer[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const errorMsg = ref('')
const loading = ref(false)

const filters = ref({
  supplier_id: '',
  customer_id: '',
  warehouse_id: '',
  product_id: '',
  date_from: '',
  date_to: '',
})

const purchaseData = ref<any>(null)
const saleData = ref<any>(null)
const valuationData = ref<any>(null)
const mutationData = ref<any>(null)

async function loadMasters() {
  const [s, c, w, p] = await Promise.all([
    useApi<Supplier[]>('/suppliers'),
    useApi<Customer[]>('/customers'),
    useApi<Warehouse[]>('/warehouses'),
    useApi<Product[]>('/products'),
  ])
  suppliers.value = s
  customers.value = c
  warehouses.value = w
  products.value = p
}

function buildQuery(keys: string[]) {
  const params = new URLSearchParams()
  for (const k of keys) {
    const v = (filters.value as any)[k]
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function runReport() {
  loading.value = true
  errorMsg.value = ''
  try {
    if (tab.value === 'purchase') {
      purchaseData.value = await useApi(`/reports/purchase${buildQuery(['supplier_id', 'warehouse_id', 'product_id', 'date_from', 'date_to'])}`)
    } else if (tab.value === 'sale') {
      saleData.value = await useApi(`/reports/sale${buildQuery(['customer_id', 'warehouse_id', 'product_id', 'date_from', 'date_to'])}`)
    } else if (tab.value === 'valuation') {
      valuationData.value = await useApi(`/reports/inventory-valuation${buildQuery(['warehouse_id', 'product_id', 'date_from', 'date_to'])}`)
    } else {
      if (!filters.value.product_id) {
        errorMsg.value = 'Pilih product untuk kartu stok (mutation report wajib per product)'
        return
      }
      mutationData.value = await useApi(`/reports/mutation${buildQuery(['product_id', 'warehouse_id', 'date_from', 'date_to'])}`)
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat report'
  } finally {
    loading.value = false
  }
}

function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function supplierName(id: string) {
  return suppliers.value.find((s) => s.id === id)?.name || id
}
function customerName(id: string) {
  return customers.value.find((c) => c.id === id)?.name || id
}

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

onMounted(loadMasters)
</script>

<template>
  <div>
    <h1>Reports</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div class="tabs">
      <button :class="{ active: tab === 'purchase' }" @click="tab = 'purchase'">Purchase</button>
      <button :class="{ active: tab === 'sale' }" @click="tab = 'sale'">Sale</button>
      <button :class="{ active: tab === 'valuation' }" @click="tab = 'valuation'">Inventory Valuation</button>
      <button :class="{ active: tab === 'mutation' }" @click="tab = 'mutation'">Mutation (Kartu Stok)</button>
    </div>

    <form class="filter-form" @submit.prevent="runReport">
      <label v-if="tab === 'purchase'">
        Supplier
        <select v-model="filters.supplier_id">
          <option value="">-- semua --</option>
          <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
      <label v-if="tab === 'sale'">
        Customer
        <select v-model="filters.customer_id">
          <option value="">-- semua --</option>
          <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label v-if="tab !== 'purchase' || true">
        Warehouse
        <select v-model="filters.warehouse_id">
          <option value="">-- semua --</option>
          <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </label>
      <label>
        Product {{ tab === 'mutation' ? '(wajib)' : '' }}
        <select v-model="filters.product_id" :required="tab === 'mutation'">
          <option value="">-- semua --</option>
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
        </select>
      </label>
      <label>
        Date From
        <input v-model="filters.date_from" type="date" />
      </label>
      <label>
        Date To
        <input v-model="filters.date_to" type="date" />
      </label>
      <button type="submit">Run Report</button>
    </form>

    <p v-if="loading">Memuat...</p>

    <template v-if="tab === 'purchase' && purchaseData">
      <h2>Outstanding Purchase Orders</h2>
      <table class="data-table">
        <thead><tr><th>No PO</th><th>Supplier</th><th>Order Date</th><th>Status</th><th>Product</th><th>Qty Order</th><th>Qty Received</th><th>Remaining</th><th>Unit Price</th></tr></thead>
        <tbody>
          <tr v-for="row in purchaseData.outstanding_purchase_orders" :key="row.item_id">
            <td>{{ row.no_po }}</td>
            <td>{{ supplierName(row.supplier_id) }}</td>
            <td>{{ row.order_date }}</td>
            <td>{{ row.status }}</td>
            <td>{{ productLabel(row.product_id) }}</td>
            <td>{{ row.qty_order }}</td>
            <td>{{ row.qty_received }}</td>
            <td>{{ row.remaining }}</td>
            <td>{{ fmt(row.unit_price) }}</td>
          </tr>
          <tr v-if="purchaseData.outstanding_purchase_orders.length === 0"><td colspan="9">Tidak ada outstanding PO</td></tr>
        </tbody>
      </table>

      <h2>Price History</h2>
      <table class="data-table">
        <thead><tr><th>Product</th><th>No PO</th><th>Order Date</th><th>Unit Price</th><th>Qty</th></tr></thead>
        <tbody>
          <tr v-for="row in purchaseData.price_history" :key="row.po_id + row.product_id">
            <td>{{ productLabel(row.product_id) }}</td>
            <td>{{ row.no_po }}</td>
            <td>{{ row.order_date }}</td>
            <td>{{ fmt(row.unit_price) }}</td>
            <td>{{ row.qty_order }}</td>
          </tr>
          <tr v-if="purchaseData.price_history.length === 0"><td colspan="5">Tidak ada data</td></tr>
        </tbody>
      </table>
    </template>

    <template v-if="tab === 'sale' && saleData">
      <h2>Summary</h2>
      <div class="summary-box">
        <div>Total Revenue: <strong>{{ fmt(saleData.summary.total_revenue) }}</strong></div>
        <div>Total COGS: <strong>{{ fmt(saleData.summary.total_cogs) }}</strong></div>
        <div>Total Margin: <strong>{{ fmt(saleData.summary.total_margin) }}</strong></div>
      </div>
      <table class="data-table">
        <thead><tr><th>No SO</th><th>Source</th><th>Customer</th><th>Product</th><th>Qty</th><th>Sell Price</th><th>COGS/unit</th><th>Revenue</th><th>COGS</th><th>Margin</th></tr></thead>
        <tbody>
          <tr v-for="(row, i) in saleData.lines" :key="i">
            <td>{{ row.no_so }}</td>
            <td>{{ row.source_type.toUpperCase() }}{{ row.no_do ? ' / ' + row.no_do : '' }}</td>
            <td>{{ customerName(row.customer_id) }}</td>
            <td>{{ productLabel(row.product_id) }}</td>
            <td>{{ row.qty }}</td>
            <td>{{ fmt(row.sell_price) }}</td>
            <td>{{ fmt(row.cogs_per_unit) }}</td>
            <td>{{ fmt(row.revenue) }}</td>
            <td>{{ fmt(row.cogs) }}</td>
            <td>{{ fmt(row.margin) }}</td>
          </tr>
          <tr v-if="saleData.lines.length === 0"><td colspan="10">Tidak ada data</td></tr>
        </tbody>
      </table>
    </template>

    <template v-if="tab === 'valuation' && valuationData">
      <p v-if="valuationData.message" class="hint">{{ valuationData.message }}</p>
      <div class="summary-box">
        <div>Total Qty On Hand: <strong>{{ fmt(valuationData.summary.total_qty_on_hand) }}</strong></div>
        <div>Total Value: <strong>{{ fmt(valuationData.summary.total_value) }}</strong></div>
      </div>
      <table class="data-table">
        <thead><tr><th>Snapshot Date</th><th>Product</th><th>Warehouse</th><th>Qty On Hand</th><th>Total Value</th></tr></thead>
        <tbody>
          <tr v-for="row in valuationData.snapshots" :key="row.id">
            <td>{{ row.snapshot_date }}</td>
            <td>{{ productLabel(row.product_id) }}</td>
            <td>{{ warehouseName(row.warehouse_id) }}</td>
            <td>{{ row.qty_on_hand }}</td>
            <td>{{ fmt(row.total_value) }}</td>
          </tr>
          <tr v-if="valuationData.snapshots.length === 0"><td colspan="5">Belum ada snapshot</td></tr>
        </tbody>
      </table>
    </template>

    <template v-if="tab === 'mutation' && mutationData">
      <div class="summary-box">
        <div>Opening Balance: <strong>{{ mutationData.opening_balance_qty }}</strong> ({{ fmt(mutationData.opening_balance_value) }})</div>
        <div>Closing Balance: <strong>{{ mutationData.closing_balance_qty }}</strong> ({{ fmt(mutationData.closing_balance_value) }})</div>
      </div>
      <table class="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Qty In</th><th>Qty Out</th><th>HPP Used</th><th>Balance Qty</th><th>Balance Value</th></tr></thead>
        <tbody>
          <tr v-for="row in mutationData.entries" :key="row.id">
            <td>{{ new Date(row.transaction_date).toLocaleString() }}</td>
            <td>{{ row.transaction_type }}</td>
            <td>{{ row.qty_in }}</td>
            <td>{{ row.qty_out }}</td>
            <td>{{ row.hpp_used ?? '-' }}</td>
            <td>{{ row.running_balance_qty }}</td>
            <td>{{ fmt(row.running_balance_value) }}</td>
          </tr>
          <tr v-if="mutationData.entries.length === 0"><td colspan="7">Tidak ada mutasi</td></tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.hint { font-size: 13px; color: #64748b; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button { padding: 8px 14px; border: none; border-radius: 6px; background: #e2e8f0; color: #334155; cursor: pointer; }
.tabs button.active { background: #2563eb; color: #fff; }
.filter-form { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
.filter-form label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
input, select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
h2 { margin: 20px 0 10px; font-size: 16px; }
.summary-box { display: flex; gap: 24px; background: #fff; padding: 14px 16px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
.data-table th, .data-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.error { color: #dc2626; }
</style>
