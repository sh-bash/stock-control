<script setup lang="ts">
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }

const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const selectedWarehouse = ref('')
const loading = ref(false)
const errorMsg = ref('')

const overview = ref<any>(null)
const aging = ref<any>(null)
const movement = ref<any>(null)
const lowStock = ref<any>(null)
const trend = ref<any>(null)
const pendingApprovals = ref<any[]>([])

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const qs = selectedWarehouse.value ? `?warehouse_id=${selectedWarehouse.value}` : ''
    const [ov, ag, mv, ls, tr, pa] = await Promise.all([
      useApi(`/dashboard/stock-value-overview${qs}`),
      useApi(`/dashboard/aging-summary${qs}`),
      useApi(`/dashboard/movement-summary${qs}`),
      useApi(`/dashboard/low-stock${qs}`),
      useApi(`/dashboard/purchase-sale-trend${qs}`),
      useApi<any[]>('/dashboard/pending-approvals'),
    ])
    overview.value = ov
    aging.value = ag
    movement.value = mv
    lowStock.value = ls
    trend.value = tr
    pendingApprovals.value = pa
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat dashboard'
  } finally {
    loading.value = false
  }
}

async function loadMasters() {
  const [w, p] = await Promise.all([useApi<Warehouse[]>('/warehouses'), useApi<Product[]>('/products')])
  warehouses.value = w
  products.value = p
}

function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function warehouseName(id: string) {
  return warehouses.value.find((w) => w.id === id)?.name || id
}
function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

const agingChart = computed(() => ({
  series: aging.value ? aging.value.buckets.map((b: any) => b.qty) : [],
  options: {
    labels: aging.value ? aging.value.buckets.map((b: any) => `${b.label} hari`) : [],
    colors: ['#16a34a', '#eab308', '#ea580c', '#dc2626'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: true },
  },
}))

const movementChart = computed(() => ({
  series: [{ name: 'SKU', data: movement.value ? movement.value.classifications.map((c: any) => c.count) : [] }],
  options: {
    chart: { toolbar: { show: false } },
    xaxis: { categories: movement.value ? movement.value.classifications.map((c: any) => c.label) : [] },
    colors: ['#2563eb'],
    plotOptions: { bar: { distributed: true, borderRadius: 4 } },
    legend: { show: false },
  },
}))

const trendChart = computed(() => ({
  series: [
    { name: 'Purchase (Rp)', data: trend.value ? trend.value.trend.map((t: any) => t.purchase_value) : [] },
    { name: 'Sale (Rp)', data: trend.value ? trend.value.trend.map((t: any) => t.sale_value) : [] },
  ],
  options: {
    chart: { toolbar: { show: false } },
    xaxis: { categories: trend.value ? trend.value.trend.map((t: any) => t.day) : [] },
    colors: ['#16a34a', '#2563eb'],
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
  },
}))

onMounted(async () => {
  await loadMasters()
  await loadAll()
})
</script>

<template>
  <div>
    <div class="header-row">
      <h1>Dashboard</h1>
      <select v-model="selectedWarehouse" @change="loadAll">
        <option value="">Semua Warehouse</option>
        <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
      </select>
    </div>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <p v-if="loading">Memuat...</p>

    <template v-else>
      <div class="grid">
        <!-- Stock Value Overview -->
        <div class="card">
          <h3>Stock Value Overview</h3>
          <div class="big-number">Rp {{ fmt(overview?.total_value ?? 0) }}</div>
          <div class="sub">{{ fmt(overview?.total_qty_on_hand ?? 0) }} unit &middot; {{ overview?.product_count ?? 0 }} produk</div>
          <table v-if="!selectedWarehouse && overview?.by_warehouse?.length" class="mini-table">
            <tr v-for="w in overview.by_warehouse" :key="w.warehouse_id">
              <td>{{ warehouseName(w.warehouse_id) }}</td>
              <td>Rp {{ fmt(w.total_value) }}</td>
            </tr>
          </table>
        </div>

        <!-- Aging Summary -->
        <div class="card">
          <h3>Aging Summary</h3>
          <ClientOnly>
            <apexchart type="donut" height="240" :options="agingChart.options" :series="agingChart.series" />
          </ClientOnly>
        </div>

        <!-- Movement Classification -->
        <div class="card">
          <h3>Movement Classification</h3>
          <ClientOnly>
            <apexchart type="bar" height="240" :options="movementChart.options" :series="movementChart.series" />
          </ClientOnly>
        </div>

        <!-- Pending Approval -->
        <div class="card">
          <h3>Pending Approvals</h3>
          <ul class="approval-list">
            <li v-for="a in pendingApprovals" :key="a.id">
              <span class="doc-type">{{ a.document_type.toUpperCase() }}</span>
              step {{ a.current_step }} &middot; {{ new Date(a.created_at).toLocaleDateString() }}
            </li>
            <li v-if="pendingApprovals.length === 0" class="empty">Tidak ada approval pending untukmu</li>
          </ul>
        </div>
      </div>

      <div class="grid grid-2">
        <!-- Purchase vs Sale Trend -->
        <div class="card">
          <h3>Purchase vs Sale Trend</h3>
          <ClientOnly>
            <apexchart type="line" height="280" :options="trendChart.options" :series="trendChart.series" />
          </ClientOnly>
        </div>

        <!-- Low Stock Alert -->
        <div class="card">
          <h3>Low Stock Alert</h3>
          <table class="data-table">
            <thead><tr><th>Product</th><th>Warehouse</th><th>Qty</th><th>Threshold</th><th>Severity</th></tr></thead>
            <tbody>
              <tr v-for="a in lowStock?.alerts ?? []" :key="a.product_id + a.warehouse_id">
                <td>{{ productLabel(a.product_id) }}</td>
                <td>{{ warehouseName(a.warehouse_id) }}</td>
                <td>{{ a.qty_on_hand }}</td>
                <td>{{ a.severity === 'danger' ? a.min_stock : a.reorder_point }}</td>
                <td><span class="badge" :class="`badge-${a.severity}`">{{ a.severity }}</span></td>
              </tr>
              <tr v-if="!lowStock?.alerts?.length"><td colspan="5">Tidak ada alert</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="link-detail">
        <NuxtLink to="/dashboard/stock-aging-projection">Lihat detail Stock Aging &amp; Projection &rarr;</NuxtLink>
      </p>
    </template>
  </div>
</template>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
select { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; }
.grid-2 { grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); }
.card { background: #fff; border-radius: 8px; padding: 16px; }
.card h3 { margin: 0 0 12px; font-size: 14px; color: #334155; }
.big-number { font-size: 28px; font-weight: 700; color: #0f172a; }
.sub { font-size: 13px; color: #64748b; margin-top: 4px; }
.mini-table { width: 100%; margin-top: 12px; font-size: 13px; }
.mini-table td { padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
.approval-list { list-style: none; padding: 0; margin: 0; font-size: 13px; display: flex; flex-direction: column; gap: 8px; }
.doc-type { display: inline-block; padding: 1px 6px; background: #e2e8f0; border-radius: 4px; font-size: 11px; margin-right: 6px; }
.empty { color: #94a3b8; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #e2e8f0; }
.badge-danger { background: #fee2e2; color: #dc2626; }
.badge-warning { background: #fef3c7; color: #b45309; }
.link-detail { margin-top: 8px; }
.error { color: #dc2626; }
</style>
