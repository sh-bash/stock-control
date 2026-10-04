<script setup lang="ts">
// Dashboard: procurement pipeline first (Request → Comparison → PO → Shipment →
// Receiving), then stock health. Chart colors follow the dataviz method: one
// validated categorical hue (blue) for single-series charts, a one-hue
// sequential ramp for magnitude, status colors only for status.
interface Warehouse { id: string; name: string }
interface Product { id: string; sku: string; name: string }

const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const selectedWarehouse = ref('')
const loading = ref(true)
const errorMsg = ref('')

const overview = ref<any>(null)
const aging = ref<any>(null)
const movement = ref<any>(null)
const lowStock = ref<any>(null)
const proc = ref<any>(null)
const pendingApprovals = ref<any[]>([])

const SERIES = '#2a78d6'
const RAMP = ['#c9defa', '#8fbcec', '#4f8fdc', '#1f5aa6']
const INK = '#52514e'

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const qs = selectedWarehouse.value ? `?warehouse_id=${selectedWarehouse.value}` : ''
    const [ov, ag, mv, ls, pr, pa] = await Promise.all([
      useApi(`/dashboard/stock-value-overview${qs}`),
      useApi(`/dashboard/aging-summary${qs}`),
      useApi(`/dashboard/movement-summary${qs}`),
      useApi(`/dashboard/low-stock${qs}`),
      useApi(`/dashboard/procurement-overview${qs}`),
      useApi<any[]>('/dashboard/pending-approvals'),
    ])
    overview.value = ov
    aging.value = ag
    movement.value = mv
    lowStock.value = ls
    proc.value = pr
    pendingApprovals.value = pa
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat dashboard'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const [w, p] = await Promise.all([useApi<Warehouse[]>('/warehouses'), useApi<Product[]>('/products')])
  warehouses.value = w
  products.value = p
  await loadAll()
})

const productLabel = (id: string) => {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
const warehouseName = (id: string) => warehouses.value.find((w) => w.id === id)?.name || id
const rupiah = (v: number) => `Rp ${formatNumber(v, 0)}`
// Compact money for KPI cards: 1,2 M / 350 jt
function compact(v: number) {
  const n = Math.abs(v)
  if (n >= 1e12) return `${formatNumber(v / 1e12, 2)} T`
  if (n >= 1e9) return `${formatNumber(v / 1e9, 2)} M`
  if (n >= 1e6) return `${formatNumber(v / 1e6, 1)} jt`
  return formatNumber(v, 0)
}
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
}

// ---- pipeline ----
const count = (m: Record<string, number> | undefined, ...keys: string[]) => keys.reduce((s, k) => s + (m?.[k] ?? 0), 0)
const stages = computed(() => {
  const p = proc.value?.pipeline
  if (!p) return []
  return [
    {
      key: 'request', label: 'Product Request', icon: '📝', to: '/purchase/requests',
      main: count(p.requests, 'draft', 'waiting_approval', 'approved', 'comparing'),
      mainLabel: 'berjalan',
      chips: [
        { label: 'menunggu approval', n: count(p.requests, 'waiting_approval'), tone: 'warning' },
        { label: 'siap dibandingkan', n: count(p.requests, 'approved', 'comparing'), tone: 'info' },
      ],
    },
    {
      key: 'comparison', label: 'Comparison', icon: '⚖️', to: '/purchase/comparisons',
      main: count(p.comparisons, 'draft', 'in_review'),
      mainLabel: 'dalam analisa',
      chips: [{ label: 'sudah diputuskan', n: count(p.comparisons, 'decided'), tone: 'success' }],
    },
    {
      key: 'po', label: 'Purchase Order', icon: '🧾', to: '/purchase/orders',
      main: count(p.orders, 'approved', 'partial_received'),
      mainLabel: 'belum selesai diterima',
      chips: [
        { label: 'draft', n: count(p.orders, 'draft'), tone: 'neutral' },
        { label: 'menunggu approval', n: count(p.orders, 'waiting_approval'), tone: 'warning' },
      ],
    },
    {
      key: 'shipment', label: 'Shipment', icon: '🚚', to: '/purchase/shipments',
      main: count(p.shipments, 'in_transit'),
      mainLabel: 'dalam perjalanan',
      chips: [
        { label: 'draft', n: count(p.shipments, 'draft'), tone: 'neutral' },
        { label: 'sudah tiba', n: count(p.shipments, 'arrived'), tone: 'info' },
      ],
    },
    {
      key: 'receiving', label: 'Receiving', icon: '📦', to: '/purchase/receivings',
      main: count(p.receivings, 'draft', 'waiting_approval'),
      mainLabel: 'perlu diproses',
      chips: [
        { label: 'menunggu approval', n: count(p.receivings, 'waiting_approval'), tone: 'warning' },
        { label: 'selesai', n: count(p.receivings, 'approved'), tone: 'success' },
      ],
    },
  ]
})

// ---- charts ----
const baseChart = { toolbar: { show: false }, fontFamily: 'inherit', foreColor: INK, animations: { speed: 350 } }
const grid = { borderColor: '#e2e8f0', strokeDashArray: 3, xaxis: { lines: { show: false } } }

const monthlyChart = computed(() => {
  const rows = proc.value?.monthly_po ?? []
  return {
    series: [{ name: 'Nilai PO', data: rows.map((r: any) => r.value) }],
    options: {
      chart: baseChart,
      colors: [SERIES],
      plotOptions: { bar: { columnWidth: '38%', borderRadius: 4, borderRadiusApplication: 'end' } },
      dataLabels: { enabled: false },
      grid,
      xaxis: { categories: rows.map((r: any) => monthLabel(r.month)), axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { formatter: (v: number) => compact(v) } },
      tooltip: {
        y: { formatter: (v: number) => rupiah(v) },
      },
      noData: { text: 'Belum ada PO' },
    },
  }
})

const sparkline = computed(() => ({
  series: [{ data: (proc.value?.monthly_po ?? []).map((r: any) => r.value) }],
  options: {
    chart: { sparkline: { enabled: true }, animations: { enabled: false } },
    stroke: { width: 2, curve: 'smooth' },
    colors: [SERIES],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0 } },
    tooltip: { fixed: { enabled: false }, x: { show: false }, y: { formatter: (v: number) => rupiah(v) }, marker: { show: false } },
  },
}))

const supplierChart = computed(() => {
  const rows = proc.value?.top_suppliers ?? []
  return {
    series: [{ name: 'Nilai PO (90 hari)', data: rows.map((r: any) => r.value) }],
    options: {
      chart: baseChart,
      colors: [SERIES],
      plotOptions: { bar: { horizontal: true, barHeight: '42%', borderRadius: 4, borderRadiusApplication: 'end' } },
      dataLabels: { enabled: false },
      grid: { borderColor: '#e2e8f0', strokeDashArray: 3, yaxis: { lines: { show: false } } },
      xaxis: { categories: rows.map((r: any) => r.name), labels: { formatter: (v: any) => compact(Number(v)) } },
      tooltip: { y: { formatter: (v: number) => rupiah(v) } },
      noData: { text: 'Belum ada data' },
    },
  }
})

const warehouseChart = computed(() => {
  const rows = overview.value?.by_warehouse ?? []
  return {
    series: [{ name: 'Nilai stok', data: rows.map((r: any) => Number(r.total_value)) }],
    options: {
      chart: baseChart,
      colors: [SERIES],
      plotOptions: { bar: { horizontal: true, barHeight: '42%', borderRadius: 4, borderRadiusApplication: 'end' } },
      dataLabels: { enabled: false },
      grid: { borderColor: '#e2e8f0', strokeDashArray: 3, yaxis: { lines: { show: false } } },
      xaxis: { categories: rows.map((r: any) => warehouseName(r.warehouse_id)), labels: { formatter: (v: any) => compact(Number(v)) } },
      tooltip: { y: { formatter: (v: number) => rupiah(v) } },
      noData: { text: 'Belum ada stok' },
    },
  }
})

// Aging is magnitude → one-hue sequential ramp (older = darker), not a rainbow donut.
const agingChart = computed(() => {
  const b = aging.value?.buckets ?? []
  return {
    series: [{ name: 'Qty', data: b.map((x: any) => Number(x.qty)) }],
    options: {
      chart: baseChart,
      colors: [(opts: any) => RAMP[opts.dataPointIndex] ?? SERIES],
      plotOptions: { bar: { distributed: true, columnWidth: '46%', borderRadius: 4, borderRadiusApplication: 'end' } },
      legend: { show: false },
      dataLabels: { enabled: false },
      grid,
      xaxis: { categories: b.map((x: any) => `${x.label} hari`), axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { formatter: (v: number) => formatQty(v) } },
      tooltip: { y: { formatter: (v: number) => `${formatQty(v)} unit` } },
    },
  }
})

const movementChart = computed(() => {
  const c = movement.value?.classifications ?? []
  return {
    series: [{ name: 'SKU', data: c.map((x: any) => x.count) }],
    options: {
      chart: baseChart,
      colors: [SERIES],
      plotOptions: { bar: { columnWidth: '38%', borderRadius: 4, borderRadiusApplication: 'end' } },
      dataLabels: { enabled: false },
      grid,
      xaxis: { categories: c.map((x: any) => x.label), axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { formatter: (v: number) => formatInt(v) } },
      tooltip: { y: { formatter: (v: number) => `${formatInt(v)} SKU` } },
    },
  }
})

const actionCount = computed(() => {
  const p = proc.value?.pipeline
  return pendingApprovals.value.length + (p ? count(p.requests, 'waiting_approval') : 0)
})
const overdueCount = computed(() => (proc.value?.shipments_in_flight ?? []).filter((s: any) => s.overdue).length)
const inTransitCount = computed(() => count(proc.value?.pipeline?.shipments, 'in_transit'))

function etaLabel(s: any) {
  if (!s.eta_date) return 'ETA belum diisi'
  const days = Math.round((new Date(s.eta_date).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
  if (s.status === 'arrived') return 'Sudah tiba'
  if (days < 0) return `Terlambat ${-days} hari`
  if (days === 0) return 'Tiba hari ini'
  return `${days} hari lagi`
}
const DOC_LINK: Record<string, string> = { product_request: '/purchase/requests', po: '/purchase/orders', receiving: '/purchase/receivings', purchase_return: '/purchase/returns', adjustment: '/stock/adjustments' }
</script>

<template>
  <div>
    <BasePageHeader title="Dashboard" description="Pipeline pengadaan dan kesehatan stok dalam satu layar.">
      <template #actions>
        <BaseSelect
          v-model="selectedWarehouse"
          placeholder="Semua Warehouse"
          :options="warehouses.map((w) => ({ value: w.id, label: w.name }))"
          @update:model-value="loadAll"
        />
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <div v-if="loading && !proc" class="skeleton-grid"><div v-for="n in 4" :key="n" class="skeleton" /></div>

    <template v-else-if="proc">
      <!-- KPI row -->
      <section class="kpis">
        <article class="kpi">
          <span class="kpi-label">Nilai Stok</span>
          <strong class="kpi-value">{{ rupiah(overview?.total_value ?? 0) }}</strong>
          <span class="kpi-sub">{{ formatQty(overview?.total_qty_on_hand ?? 0) }} unit · {{ formatInt(overview?.product_count ?? 0) }} SKU</span>
        </article>
        <article class="kpi">
          <span class="kpi-label">PO Belum Diterima</span>
          <strong class="kpi-value">{{ rupiah(proc.open_po.value) }}</strong>
          <span class="kpi-sub">{{ proc.open_po.count }} PO berjalan</span>
          <ClientOnly><apexchart class="kpi-spark" type="area" height="38" :options="sparkline.options" :series="sparkline.series" /></ClientOnly>
        </article>
        <NuxtLink to="/purchase/shipments" class="kpi link">
          <span class="kpi-label">Shipment Dalam Perjalanan</span>
          <strong class="kpi-value">{{ inTransitCount }}</strong>
          <span class="kpi-sub" :class="{ bad: overdueCount }">{{ overdueCount ? `⚠ ${overdueCount} terlambat dari ETA` : 'Semua sesuai jadwal' }}</span>
        </NuxtLink>
        <NuxtLink to="/approval/inbox" class="kpi link">
          <span class="kpi-label">Perlu Tindakan</span>
          <strong class="kpi-value">{{ actionCount }}</strong>
          <span class="kpi-sub">{{ pendingApprovals.length }} approval untukmu · {{ count(proc.pipeline.requests, 'waiting_approval') }} request menunggu</span>
        </NuxtLink>
      </section>

      <!-- Pipeline -->
      <section class="panel">
        <h3>Pipeline Pengadaan</h3>
        <ol class="pipeline">
          <li v-for="s in stages" :key="s.key">
            <NuxtLink :to="s.to" class="stage">
              <span class="stage-icon">{{ s.icon }}</span>
              <span class="stage-name">{{ s.label }}</span>
              <strong class="stage-n">{{ s.main }}</strong>
              <span class="stage-sub">{{ s.mainLabel }}</span>
              <span class="stage-chips">
                <BaseBadge v-for="c in s.chips.filter((c) => c.n > 0)" :key="c.label" :tone="c.tone as any">{{ c.n }} {{ c.label }}</BaseBadge>
              </span>
            </NuxtLink>
          </li>
        </ol>
      </section>

      <!-- Procurement charts -->
      <section class="row r-3-2">
        <article class="panel">
          <h3>Nilai PO per Bulan <span class="muted">· 6 bulan terakhir, Rp</span></h3>
          <ClientOnly><apexchart type="bar" height="250" :options="monthlyChart.options" :series="monthlyChart.series" /></ClientOnly>
        </article>
        <article class="panel">
          <h3>Supplier Teratas <span class="muted">· 90 hari</span></h3>
          <ClientOnly><apexchart type="bar" height="250" :options="supplierChart.options" :series="supplierChart.series" /></ClientOnly>
        </article>
      </section>

      <!-- Shipments + approvals -->
      <section class="row r-3-2">
        <article class="panel">
          <h3>Shipment yang Sedang Berjalan</h3>
          <p v-if="!proc.shipments_in_flight.length" class="muted">Tidak ada shipment berjalan.</p>
          <ul v-else class="ship-list">
            <li v-for="s in proc.shipments_in_flight" :key="s.id">
              <NuxtLink :to="`/purchase/shipments/${s.id}`" class="ship">
                <div class="ship-main">
                  <strong>{{ s.no_shipment }}</strong>
                  <span class="muted">{{ s.expedition_name }}<template v-if="s.tracking_no"> · {{ s.tracking_no }}</template></span>
                </div>
                <div class="ship-meta">
                  <span>{{ s.total_weight ? `${formatQty(s.total_weight)} kg` : '-' }}</span>
                  <span>{{ formatQty(s.total_qty) }} unit</span>
                </div>
                <div class="ship-eta" :class="{ bad: s.overdue }">
                  <BaseBadge :status="s.status" />
                  <span>{{ etaLabel(s) }}</span>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </article>

        <article class="panel">
          <h3>Menunggu Persetujuan Kamu</h3>
          <ul class="approval-list">
            <li v-for="a in pendingApprovals" :key="a.id">
              <NuxtLink :to="DOC_LINK[a.document_type] ?? '/approval/inbox'" class="approval">
                <BaseBadge tone="neutral">{{ a.document_type.replace('_', ' ').toUpperCase() }}</BaseBadge>
                <BaseApprovalStepper :current-step="a.current_step" />
                <span class="muted small">{{ new Date(a.created_at).toLocaleDateString('id-ID') }}</span>
              </NuxtLink>
            </li>
            <li v-if="!pendingApprovals.length" class="muted">Tidak ada approval pending untukmu 🎉</li>
          </ul>
        </article>
      </section>

      <!-- Stock health -->
      <h2 class="section-title">Kesehatan Stok</h2>
      <section class="row r-3">
        <article class="panel">
          <h3>Nilai Stok per Gudang <span class="muted">· Rp</span></h3>
          <ClientOnly><apexchart type="bar" height="230" :options="warehouseChart.options" :series="warehouseChart.series" /></ClientOnly>
        </article>
        <article class="panel">
          <h3>Umur Stok <span class="muted">· unit per rentang hari</span></h3>
          <ClientOnly><apexchart type="bar" height="230" :options="agingChart.options" :series="agingChart.series" /></ClientOnly>
        </article>
        <article class="panel">
          <h3>Klasifikasi Pergerakan <span class="muted">· jumlah SKU</span></h3>
          <ClientOnly><apexchart type="bar" height="230" :options="movementChart.options" :series="movementChart.series" /></ClientOnly>
        </article>
      </section>

      <section class="panel">
        <h3>Peringatan Stok Rendah</h3>
        <div class="table-scroll">
          <table class="doc-table">
            <thead><tr><th>Produk</th><th>Warehouse</th><th class="num">Qty</th><th class="num">Batas</th><th>Tingkat</th></tr></thead>
            <tbody>
              <tr v-for="a in lowStock?.alerts ?? []" :key="a.product_id + a.warehouse_id">
                <td>{{ productLabel(a.product_id) }}</td>
                <td>{{ warehouseName(a.warehouse_id) }}</td>
                <td class="num">{{ formatQty(a.qty_on_hand) }}</td>
                <td class="num">{{ formatQty(a.severity === 'danger' ? a.min_stock : a.reorder_point) }}</td>
                <td><BaseBadge :status="a.severity" /></td>
              </tr>
              <tr v-if="!lowStock?.alerts?.length"><td colspan="5" class="muted">Semua stok aman ✅</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="link-detail"><NuxtLink to="/dashboard/stock-aging-projection">Lihat detail Stock Aging &amp; Projection →</NuxtLink></p>
    </template>
  </div>
</template>

<style scoped>
.small { font-size: 12px; }
.section-title { font-size: 16px; margin: 24px 0 12px; }
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.skeleton { height: 110px; border-radius: var(--radius-md); background: linear-gradient(90deg, var(--color-neutral-bg), var(--color-bg), var(--color-neutral-bg)); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 16px; margin-bottom: 16px; }
.kpi { position: relative; display: grid; gap: 4px; align-content: start; padding: 16px 18px; background: var(--color-surface); border-radius: var(--radius-md); box-shadow: var(--elevation-1); text-decoration: none; color: inherit; overflow: hidden; transition: box-shadow 0.15s, transform 0.15s; }
.kpi.link:hover { box-shadow: var(--elevation-2); transform: translateY(-1px); }
.kpi-label { font-size: 12px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.kpi-value { font-size: 26px; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--color-text); }
.kpi-sub { font-size: 12px; color: var(--color-text-muted); }
.kpi-sub.bad { color: var(--color-danger); font-weight: 600; }
.kpi-spark { margin: 6px -18px -16px; }

.panel { background: var(--color-surface); border-radius: var(--radius-md); box-shadow: var(--elevation-1); padding: 16px; margin-bottom: 16px; min-width: 0; }
.panel h3 { margin: 0 0 12px; font-size: 14px; color: var(--color-text); }
.panel h3 .muted { font-weight: 400; font-size: 12px; }
.row { display: grid; gap: 16px; }
.row > .panel { margin-bottom: 0; }
.row { margin-bottom: 16px; }
.r-3-2 { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
.r-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 1100px) { .r-3-2, .r-3 { grid-template-columns: minmax(0, 1fr); } }

.pipeline { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
.pipeline li { position: relative; padding-right: 14px; }
.pipeline li:not(:last-child)::after { content: '›'; position: absolute; right: 0; top: 38%; font-size: 26px; color: var(--color-neutral); }
.stage { display: grid; gap: 2px; justify-items: start; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); text-decoration: none; color: inherit; height: 100%; transition: border-color 0.15s, background 0.15s; }
.stage:hover { border-color: var(--color-primary); background: var(--color-primary-bg); }
.stage-icon { font-size: 18px; }
.stage-name { font-size: 12px; color: var(--color-text-muted); }
.stage-n { font-size: 28px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.stage-sub { font-size: 11px; color: var(--color-text-muted); margin-bottom: 6px; }
.stage-chips { display: flex; flex-wrap: wrap; gap: 4px; }
@media (max-width: 1100px) {
  .pipeline { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .pipeline li { padding-right: 0; }
  .pipeline li::after { display: none; }
}

.ship-list, .approval-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ship { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.2fr); gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); text-decoration: none; color: inherit; font-size: 13px; }
.ship:hover { border-color: var(--color-primary); }
.ship-main { display: grid; }
.ship-meta { display: grid; font-size: 12px; color: var(--color-text-muted); }
.ship-eta { display: grid; gap: 4px; justify-items: end; font-size: 12px; color: var(--color-text-muted); }
.ship-eta.bad { color: var(--color-danger); font-weight: 600; }
@media (max-width: 600px) { .ship { grid-template-columns: 1fr; } .ship-eta { justify-items: start; } }
.approval { display: flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; font-size: 13px; padding: 6px 8px; border-radius: var(--radius-sm); }
.approval:hover { background: var(--color-bg); }
.table-scroll { overflow-x: auto; }
.link-detail { margin-top: 8px; }
</style>
