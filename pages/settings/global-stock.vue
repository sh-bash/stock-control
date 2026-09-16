<script setup lang="ts">
const form = ref({
  fast_moving_min_daily_out: 0,
  slow_moving_max_daily_out: 0,
  aging_warning_days: 0,
  aging_danger_days: 0,
  dead_stock_no_movement_days: 0,
})
const loading = ref(false)
const savedMsg = ref('')
const errorMsg = ref('')

async function load() {
  loading.value = true
  try {
    const data = await useApi<any>('/settings/global-stock')
    if (data) {
      form.value = {
        fast_moving_min_daily_out: Number(data.fast_moving_min_daily_out),
        slow_moving_max_daily_out: Number(data.slow_moving_max_daily_out),
        aging_warning_days: data.aging_warning_days,
        aging_danger_days: data.aging_danger_days,
        dead_stock_no_movement_days: data.dead_stock_no_movement_days,
      }
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat settings'
  } finally {
    loading.value = false
  }
}

async function save() {
  errorMsg.value = ''
  savedMsg.value = ''
  try {
    await useApi('/settings/global-stock', { method: 'PUT', body: form.value })
    savedMsg.value = 'Tersimpan'
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menyimpan settings'
  }
}

onMounted(load)
</script>

<template>
  <div class="settings-page">
    <h1>Global Stock Settings</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <p v-if="savedMsg" class="success">{{ savedMsg }}</p>
    <form v-if="!loading" class="settings-form" @submit.prevent="save">
      <label>
        Fast Moving Min Daily Out
        <input v-model.number="form.fast_moving_min_daily_out" type="number" step="any" required />
      </label>
      <label>
        Slow Moving Max Daily Out
        <input v-model.number="form.slow_moving_max_daily_out" type="number" step="any" required />
      </label>
      <label>
        Aging Warning Days
        <input v-model.number="form.aging_warning_days" type="number" required />
      </label>
      <label>
        Aging Danger Days
        <input v-model.number="form.aging_danger_days" type="number" required />
      </label>
      <label>
        Dead Stock No Movement Days
        <input v-model.number="form.dead_stock_no_movement_days" type="number" required />
      </label>
      <button type="submit">Simpan</button>
    </form>
  </div>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  max-width: 360px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
input {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
button {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  width: fit-content;
}
.error {
  color: #dc2626;
}
.success {
  color: #16a34a;
}
</style>
