<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }
interface Row {
  product_id: string
  warehouse_id: string
  qty_on_hand: number
  oldest_layer_age_days: number | null
  avg_daily_out_qty_30d: number | null
  projected_days_to_zero: number | null
  projected_zero_date: string | null
  projection_note: string | null
  classification: string | null
}

const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const rows = ref<Row[]>([])
const selectedWarehouse = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const qs = selectedWarehouse.value ? `?warehouse_id=${selectedWarehouse.value}` : ''
    const [w, p, r] = await Promise.all([
      useApi<Warehouse[]>('/warehouses'),
      useApi<Product[]>('/products'),
      useApi<Row[]>(`/dashboard/stock-aging-projection${qs}`),
    ])
    warehouses.value = w
    products.value = p
    rows.value = r
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
    <div class="header-row">
      <h1>Stock Aging &amp; Projection</h1>
      <select v-model="selectedWarehouse" @change="loadAll">
        <option value="">Semua Warehouse</option>
        <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
      </select>
    </div>
    <p class="hint">
      projected_days_to_zero = qty_on_hand / avg_daily_out_qty_30d (§6.6). Dead stock (avg = 0) tidak punya proyeksi.
    </p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <p v-if="loading">Memuat...</p>

    <table v-else class="data-table">
      <thead>
        <tr>
          <th>Product</th><th>Warehouse</th><th>Qty On Hand</th><th>Umur Layer Tertua (hari)</th>
          <th>Avg Out/Hari (30d)</th><th>Proyeksi Habis</th><th>Classification</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.product_id + row.warehouse_id">
          <td>{{ productLabel(row.product_id) }}</td>
          <td>{{ warehouseName(row.warehouse_id) }}</td>
          <td>{{ row.qty_on_hand }}</td>
          <td>{{ row.oldest_layer_age_days ?? '-' }}</td>
          <td>{{ row.avg_daily_out_qty_30d ?? '-' }}</td>
          <td>
            <span v-if="row.projection_note" class="note-dead">{{ row.projection_note }}</span>
            <span v-else>{{ row.projected_days_to_zero }} hari ({{ row.projected_zero_date }})</span>
          </td>
          <td><span class="badge" :class="`badge-${row.classification}`">{{ row.classification ?? '-' }}</span></td>
        </tr>
        <tr v-if="rows.length === 0"><td colspan="7">Tidak ada data</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.hint { font-size: 13px; color: #64748b; margin-bottom: 12px; }
select { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; }
.data-table th, .data-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.note-dead { color: #dc2626; font-size: 12px; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #e2e8f0; }
.badge-fast { background: #dcfce7; color: #16a34a; }
.badge-normal { background: #dbeafe; color: #1d4ed8; }
.badge-slow { background: #fef3c7; color: #b45309; }
.badge-dead { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
