<script setup lang="ts">
interface FieldConfig {
  key: string
  label: string
  type?: 'text' | 'number' | 'checkbox' | 'select'
  options?: readonly { value: string; label: string }[]
  required?: boolean
}

const props = defineProps<{
  title: string
  endpoint: string
  fields: readonly FieldConfig[]
}>()

const rows = ref<any[]>([])
const loading = ref(false)
const errorMsg = ref('')
const editingId = ref<string | null>(null)

function emptyForm() {
  const obj: Record<string, any> = {}
  for (const f of props.fields) obj[f.key] = f.type === 'checkbox' ? true : ''
  return obj
}
const form = ref<Record<string, any>>(emptyForm())

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    rows.value = await useApi<any[]>(props.endpoint)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function startCreate() {
  editingId.value = null
  form.value = emptyForm()
}

function startEdit(row: any) {
  editingId.value = row.id
  const obj: Record<string, any> = {}
  for (const f of props.fields) obj[f.key] = row[f.key] ?? (f.type === 'checkbox' ? true : '')
  form.value = obj
}

async function submit() {
  errorMsg.value = ''
  const payload: Record<string, any> = {}
  for (const f of props.fields) {
    let val = form.value[f.key]
    if (f.type === 'number' && val !== '') val = Number(val)
    if (val === '') val = undefined
    payload[f.key] = val
  }
  try {
    if (editingId.value) {
      await useApi(`${props.endpoint}/${editingId.value}`, { method: 'PUT', body: payload })
    } else {
      await useApi(props.endpoint, { method: 'POST', body: payload })
    }
    startCreate()
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menyimpan data'
  }
}

async function remove(row: any) {
  if (!confirm(`Hapus "${row.name || row.code || row.sku}"?`)) return
  try {
    await useApi(`${props.endpoint}/${row.id}`, { method: 'DELETE' })
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus data'
  }
}

onMounted(load)
</script>

<template>
  <div class="crud-page">
    <h1>{{ title }}</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="crud-form" @submit.prevent="submit">
      <div v-for="f in fields" :key="f.key" class="form-field">
        <label>{{ f.label }}</label>
        <input v-if="!f.type || f.type === 'text'" v-model="form[f.key]" type="text" :required="f.required" />
        <input v-else-if="f.type === 'number'" v-model="form[f.key]" type="number" step="any" :required="f.required" />
        <input v-else-if="f.type === 'checkbox'" v-model="form[f.key]" type="checkbox" />
        <select v-else-if="f.type === 'select'" v-model="form[f.key]">
          <option value="">-</option>
          <option v-for="opt in f.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="submit">{{ editingId ? 'Update' : 'Tambah' }}</button>
        <button v-if="editingId" type="button" class="secondary" @click="startCreate">Batal</button>
      </div>
    </form>

    <p v-if="loading">Memuat...</p>
    <table v-else class="crud-table">
      <thead>
        <tr>
          <th v-for="f in fields" :key="f.key">{{ f.label }}</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td v-for="f in fields" :key="f.key">{{ row[f.key] }}</td>
          <td>
            <button class="link" @click="startEdit(row)">Edit</button>
            <button class="link danger" @click="remove(row)">Hapus</button>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="fields.length + 1">Belum ada data</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.crud-page h1 {
  margin-bottom: 16px;
}
.crud-form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.form-field input,
.form-field select {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.form-actions {
  display: flex;
  gap: 8px;
}
button {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
}
button.secondary {
  background: #94a3b8;
}
button.link {
  background: none;
  color: #2563eb;
  padding: 2px 6px;
}
button.link.danger {
  color: #dc2626;
}
.crud-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.crud-table th,
.crud-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}
.error {
  color: #dc2626;
  margin-bottom: 12px;
}
</style>
