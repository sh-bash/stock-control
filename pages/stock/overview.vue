<script setup lang="ts">
interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string }
interface StockSummary {
  id: string
  product_id: string
  warehouse_id: string
  qty_on_hand: string
  qty_reserved: string
  qty_available: string
  total_value: string
}
interface StockLayer {
  id: string
  product_id: string
  warehouse_id: string
  receive_date: string
  qty_original: string
  qty_remaining: string
  hpp: string
  status: string
}
interface LedgerRow {
  id: string
  product_id: string
  warehouse_id: string
  transaction_type: string
  transaction_date: string
  qty_in: string
  qty_out: string
  hpp_used: string | null
  running_balance_qty: string
  running_balance_value: string
}

const summary = ref<StockSummary[]>([])
const layers = ref<StockLayer[]>([])
const ledger = ref<LedgerRow[]>([])
const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const loading = ref(false)
const errorMsg = ref('')
const tab = ref<'summary' | 'layers' | 'ledger'>('summary')

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [s, l, led, p, w] = await Promise.all([
      useApi<StockSummary[]>('/stock/summary'),
      useApi<StockLayer[]>('/stock/layers'),
      useApi<LedgerRow[]>('/stock/ledger'),
      useApi<Product[]>('/products'),
      useApi<Warehouse[]>('/warehouses'),
    ])
    summary.value = s
    layers.value = l.sort((a, b) => a.receive_date.localeCompare(b.receive_date))
    ledger.value = led.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    products.value = p
    warehouses.value = w
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
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

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Stock Overview</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div class="tabs">
      <button :class="{ active: tab === 'summary' }" @click="tab = 'summary'">Stock Summary</button>
      <button :class="{ active: tab === 'layers' }" @click="tab = 'layers'">Stock Layers (FIFO)</button>
      <button :class="{ active: tab === 'ledger' }" @click="tab = 'ledger'">Stock Ledger</button>
      <button class="refresh" @click="loadAll">Refresh</button>
    </div>

    <p v-if="loading">Memuat...</p>

    <table v-else-if="tab === 'summary'" class="data-table">
      <thead><tr><th>Product</th><th>Warehouse</th><th>Qty On Hand</th><th>Qty Reserved</th><th>Qty Available</th><th>Total Value</th></tr></thead>
      <tbody>
        <tr v-for="row in summary" :key="row.id">
          <td>{{ productLabel(row.product_id) }}</td>
          <td>{{ warehouseName(row.warehouse_id) }}</td>
          <td>{{ row.qty_on_hand }}</td>
          <td>{{ row.qty_reserved }}</td>
          <td>{{ row.qty_available }}</td>
          <td>{{ row.total_value }}</td>
        </tr>
        <tr v-if="summary.length === 0"><td colspan="6">Belum ada data</td></tr>
      </tbody>
    </table>

    <table v-else-if="tab === 'layers'" class="data-table">
      <thead><tr><th>Product</th><th>Warehouse</th><th>Receive Date</th><th>Qty Original</th><th>Qty Remaining</th><th>HPP</th><th>Status</th></tr></thead>
      <tbody>
        <tr v-for="row in layers" :key="row.id">
          <td>{{ productLabel(row.product_id) }}</td>
          <td>{{ warehouseName(row.warehouse_id) }}</td>
          <td>{{ row.receive_date }}</td>
          <td>{{ row.qty_original }}</td>
          <td>{{ row.qty_remaining }}</td>
          <td>{{ row.hpp }}</td>
          <td><span class="status" :class="`status-${row.status}`">{{ row.status }}</span></td>
        </tr>
        <tr v-if="layers.length === 0"><td colspan="7">Belum ada data</td></tr>
      </tbody>
    </table>

    <table v-else class="data-table">
      <thead><tr><th>Product</th><th>Warehouse</th><th>Type</th><th>Date</th><th>Qty In</th><th>Qty Out</th><th>HPP Used</th><th>Balance Qty</th><th>Balance Value</th></tr></thead>
      <tbody>
        <tr v-for="row in ledger" :key="row.id">
          <td>{{ productLabel(row.product_id) }}</td>
          <td>{{ warehouseName(row.warehouse_id) }}</td>
          <td>{{ row.transaction_type }}</td>
          <td>{{ new Date(row.transaction_date).toLocaleString() }}</td>
          <td>{{ row.qty_in }}</td>
          <td>{{ row.qty_out }}</td>
          <td>{{ row.hpp_used ?? '-' }}</td>
          <td>{{ row.running_balance_qty }}</td>
          <td>{{ row.running_balance_value }}</td>
        </tr>
        <tr v-if="ledger.length === 0"><td colspan="9">Belum ada data</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tabs button {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #e2e8f0;
  color: #334155;
  cursor: pointer;
}
.tabs button.active {
  background: #2563eb;
  color: #fff;
}
.tabs button.refresh {
  margin-left: auto;
  background: #94a3b8;
  color: #fff;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.data-table th, .data-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}
.status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: #e2e8f0;
}
.status-active { background: #dcfce7; color: #16a34a; }
.status-exhausted { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
