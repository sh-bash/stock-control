<script setup lang="ts">
interface Product { id: string; sku: string; name: string }
interface Warehouse { id: string; name: string }
interface Setting {
  id: string
  product_id: string
  warehouse_id: string | null
  min_stock: string | null
  reorder_point: string | null
  reorder_qty: string | null
  fast_moving_min_daily_out: string | null
  slow_moving_max_daily_out: string | null
  aging_warning_days: number | null
  aging_danger_days: number | null
  is_active: boolean
}

const settings = ref<Setting[]>([])
const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const errorMsg = ref('')
const loading = ref(false)

function emptyForm() {
  return {
    product_id: '',
    warehouse_id: '' as string | '',
    min_stock: null as number | null,
    reorder_point: null as number | null,
    reorder_qty: null as number | null,
    fast_moving_min_daily_out: null as number | null,
    slow_moving_max_daily_out: null as number | null,
    aging_warning_days: null as number | null,
    aging_danger_days: null as number | null,
  }
}
const form = ref(emptyForm())

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [s, p, w] = await Promise.all([
      useApi<Setting[]>('/product-stock-settings'),
      useApi<Product[]>('/products'),
      useApi<Warehouse[]>('/warehouses'),
    ])
    settings.value = s
    products.value = p
    warehouses.value = w
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

async function createSetting() {
  errorMsg.value = ''
  try {
    await useApi('/product-stock-settings', {
      method: 'POST',
      body: { ...form.value, warehouse_id: form.value.warehouse_id || null },
    })
    form.value = emptyForm()
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat override'
  }
}

async function toggleActive(s: Setting) {
  try {
    await useApi(`/product-stock-settings/${s.id}`, { method: 'PUT', body: { is_active: !s.is_active } })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal update'
  }
}

async function removeSetting(id: string) {
  if (!confirm('Hapus override ini? Product/warehouse ini akan kembali memakai Global Stock Settings.')) return
  try {
    await useApi(`/product-stock-settings/${id}`, { method: 'DELETE' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus'
  }
}

function productLabel(id: string) {
  const p = products.value.find((p) => p.id === id)
  return p ? `${p.sku} - ${p.name}` : id
}
function warehouseName(id: string | null) {
  if (!id) return 'Semua warehouse'
  return warehouses.value.find((w) => w.id === id)?.name || id
}

onMounted(loadAll)
</script>

<template>
  <div>
    <h1>Product Stock Settings</h1>
    <p class="hint">
      Override per product dan/atau per warehouse untuk min_stock, reorder_point, reorder_qty, serta threshold
      movement/aging. Field yang dikosongkan (-) akan memakai nilai dari Global Stock Settings sebagai fallback.
      Warehouse dikosongkan = berlaku untuk semua warehouse pada product ini.
    </p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createSetting">
      <div class="row">
        <label>
          Product
          <select v-model="form.product_id" required>
            <option value="">-- pilih --</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} - {{ p.name }}</option>
          </select>
        </label>
        <label>
          Warehouse (opsional)
          <select v-model="form.warehouse_id">
            <option value="">Semua warehouse</option>
            <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
      </div>
      <div class="row">
        <label>
          Min Stock
          <input v-model.number="form.min_stock" type="number" step="any" min="0" />
        </label>
        <label>
          Reorder Point
          <input v-model.number="form.reorder_point" type="number" step="any" min="0" />
        </label>
        <label>
          Reorder Qty
          <input v-model.number="form.reorder_qty" type="number" step="any" min="0" />
        </label>
      </div>
      <div class="row">
        <label>
          Fast Moving Min Daily Out
          <input v-model.number="form.fast_moving_min_daily_out" type="number" step="any" min="0" />
        </label>
        <label>
          Slow Moving Max Daily Out
          <input v-model.number="form.slow_moving_max_daily_out" type="number" step="any" min="0" />
        </label>
      </div>
      <div class="row">
        <label>
          Aging Warning Days
          <input v-model.number="form.aging_warning_days" type="number" min="0" />
        </label>
        <label>
          Aging Danger Days
          <input v-model.number="form.aging_danger_days" type="number" min="0" />
        </label>
      </div>
      <button type="submit">Buat Override</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="settings-table">
      <thead>
        <tr>
          <th>Product</th><th>Warehouse</th><th>Min Stock</th><th>Reorder Point</th><th>Reorder Qty</th>
          <th>Fast Moving</th><th>Slow Moving</th><th>Aging Warn</th><th>Aging Danger</th><th>Status</th><th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in settings" :key="s.id">
          <td>{{ productLabel(s.product_id) }}</td>
          <td>{{ warehouseName(s.warehouse_id) }}</td>
          <td>{{ s.min_stock ?? '-' }}</td>
          <td>{{ s.reorder_point ?? '-' }}</td>
          <td>{{ s.reorder_qty ?? '-' }}</td>
          <td>{{ s.fast_moving_min_daily_out ?? '-' }}</td>
          <td>{{ s.slow_moving_max_daily_out ?? '-' }}</td>
          <td>{{ s.aging_warning_days ?? '-' }}</td>
          <td>{{ s.aging_danger_days ?? '-' }}</td>
          <td><span class="status" :class="s.is_active ? 'status-active' : 'status-inactive'">{{ s.is_active ? 'active' : 'inactive' }}</span></td>
          <td>
            <button class="link" @click="toggleActive(s)">{{ s.is_active ? 'Nonaktifkan' : 'Aktifkan' }}</button>
            <button class="link danger" @click="removeSetting(s.id)">Hapus</button>
          </td>
        </tr>
        <tr v-if="settings.length === 0"><td colspan="11">Belum ada override, semua product memakai Global Stock Settings</td></tr>
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
.settings-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; }
.settings-table th, .settings-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; align-self: flex-start; }
button.link { background: none; color: #2563eb; padding: 2px 6px; font-size: 12px; }
button.link.danger { color: #dc2626; }
.status { padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #e2e8f0; }
.status-active { background: #dcfce7; color: #16a34a; }
.status-inactive { background: #fee2e2; color: #dc2626; }
.error { color: #dc2626; }
</style>
