<script setup lang="ts">
interface JobLog {
  id: string
  job_name: string
  status: string
  rows_processed: number | null
  duration_ms: number | null
  error_message: string | null
  executed_at: string
}
interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string }
interface Classification {
  id: string
  product_id: string
  warehouse_id: string
  classification: string
  calculated_at: string
}

const logs = ref<JobLog[]>([])
const classifications = ref<Classification[]>([])
const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const loading = ref(false)
const errorMsg = ref('')
const running = ref<string | null>(null)

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [l, c, p, w] = await Promise.all([
      useApi<JobLog[]>('/jobs/logs'),
      useApi<Classification[]>('/analytics/movement-classification'),
      useApi<Product[]>('/products'),
      useApi<Warehouse[]>('/warehouses'),
    ])
    logs.value = l
    classifications.value = c
    products.value = p
    warehouses.value = w
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

async function runJob(name: string) {
  running.value = name
  errorMsg.value = ''
  try {
    await useApi(`/jobs/${name}/run`, { method: 'POST' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || `Gagal menjalankan job ${name}`
  } finally {
    running.value = null
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
    <h1>Scheduled Jobs</h1>
    <p class="hint">
      Jadwal otomatis: movement-classification & aging-check jalan harian 01:00, stock-reconciliation mingguan
      (Minggu 02:00). Tombol di bawah memicu job secara manual untuk testing.
    </p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div class="trigger-box">
      <button :disabled="running === 'movement-classification'" @click="runJob('movement-classification')">
        {{ running === 'movement-classification' ? 'Running...' : 'Run Movement Classification' }}
      </button>
      <button :disabled="running === 'aging-check'" @click="runJob('aging-check')">
        {{ running === 'aging-check' ? 'Running...' : 'Run Aging Check' }}
      </button>
      <button :disabled="running === 'stock-reconciliation'" @click="runJob('stock-reconciliation')">
        {{ running === 'stock-reconciliation' ? 'Running...' : 'Run Stock Reconciliation' }}
      </button>
      <button class="refresh" @click="loadAll">Refresh</button>
    </div>

    <p v-if="loading">Memuat...</p>
    <template v-else>
      <h2>Movement Classification</h2>
      <table class="data-table">
        <thead><tr><th>Product</th><th>Warehouse</th><th>Classification</th><th>Calculated At</th></tr></thead>
        <tbody>
          <tr v-for="c in classifications" :key="c.id">
            <td>{{ productLabel(c.product_id) }}</td>
            <td>{{ warehouseName(c.warehouse_id) }}</td>
            <td><span class="badge" :class="`badge-${c.classification}`">{{ c.classification }}</span></td>
            <td>{{ new Date(c.calculated_at).toLocaleString() }}</td>
          </tr>
          <tr v-if="classifications.length === 0"><td colspan="4">Belum ada data, jalankan job dulu</td></tr>
        </tbody>
      </table>

      <h2>Job Execution Logs</h2>
      <table class="data-table">
        <thead><tr><th>Job</th><th>Status</th><th>Rows</th><th>Duration (ms)</th><th>Executed At</th><th>Note</th></tr></thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ log.job_name }}</td>
            <td><span class="badge" :class="`badge-status-${log.status}`">{{ log.status }}</span></td>
            <td>{{ log.rows_processed ?? '-' }}</td>
            <td>{{ log.duration_ms ?? '-' }}</td>
            <td>{{ new Date(log.executed_at).toLocaleString() }}</td>
            <td class="note">{{ log.error_message ?? '-' }}</td>
          </tr>
          <tr v-if="logs.length === 0"><td colspan="6">Belum ada log</td></tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.hint { font-size: 13px; color: #64748b; margin-bottom: 12px; }
.trigger-box { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
button.refresh { background: #94a3b8; margin-left: auto; }
h2 { margin: 20px 0 10px; font-size: 16px; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
.data-table th, .data-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.note { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #e2e8f0; }
.badge-fast { background: #dcfce7; color: #16a34a; }
.badge-normal { background: #dbeafe; color: #1d4ed8; }
.badge-slow { background: #fef3c7; color: #b45309; }
.badge-dead { background: #fee2e2; color: #dc2626; }
.badge-status-success { background: #dcfce7; color: #16a34a; }
.badge-status-warning { background: #fef3c7; color: #b45309; }
.badge-status-failed { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
