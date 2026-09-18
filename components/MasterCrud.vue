<script setup lang="ts">
// Shared list+form UI for all 7 Master Data pages (Warehouses, Product
// Categories, Units, Products, Suppliers, Customers, Expeditions) — each
// page file just passes `title`/`endpoint`/`fields`, so this one refactor
// covers all of them. Uses server-side pagination/search/sort/filter
// (opt-in on the API side — see server/utils/crud.ts's parsePagingQuery)
// via BaseDataTable, and a BaseModal for create/edit instead of an
// always-visible inline form.
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
const totalRows = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const hasStatusColumn = ref(false)

const page = ref(1)
const pageSize = 20
const search = ref('')
const statusFilter = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })

const columns = computed(() => {
  const cols = props.fields.map((f) => ({ key: f.key, label: f.label, sortable: true }))
  if (hasStatusColumn.value) {
    cols.push({
      key: 'is_active',
      label: 'Status',
      sortable: false,
      filterOptions: [
        { value: 'true', label: 'Aktif' },
        { value: 'false', label: 'Nonaktif' },
      ],
    } as any)
  }
  return cols
})

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (search.value) params.set('search', search.value)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    if (statusFilter.value) params.set('is_active', statusFilter.value)

    const res = await useApiEnvelope<any[]>(`${props.endpoint}?${params.toString()}`)
    rows.value = res.data
    totalRows.value = Number(res.meta?.totalRows ?? rows.value.length)
    // Sticky once detected — an empty page (e.g. filtered to zero results)
    // must not make the Status column/filter disappear.
    if (rows.value.length > 0 && 'is_active' in rows.value[0]) hasStatusColumn.value = true
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function onSearchChange(v: string) {
  search.value = v
  page.value = 1
  load()
}
function onFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'is_active') {
    statusFilter.value = value
    page.value = 1
    load()
  }
}
function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  sort.value = s
  load()
}
function onPageChange(p: number) {
  page.value = p
  load()
}

// --- create/edit modal ---
const showModal = ref(false)
const editingId = ref<string | null>(null)
const formErrors = ref<Record<string, string>>({})
const submitting = ref(false)

function emptyForm() {
  const obj: Record<string, any> = {}
  for (const f of props.fields) obj[f.key] = f.type === 'checkbox' ? true : f.type === 'number' ? null : ''
  return obj
}
const form = ref<Record<string, any>>(emptyForm())

function startCreate() {
  editingId.value = null
  form.value = emptyForm()
  formErrors.value = {}
  showModal.value = true
}
function startEdit(row: any) {
  editingId.value = row.id
  const obj: Record<string, any> = {}
  for (const f of props.fields) obj[f.key] = row[f.key] ?? (f.type === 'checkbox' ? true : f.type === 'number' ? null : '')
  form.value = obj
  formErrors.value = {}
  showModal.value = true
}

function validate() {
  const errs: Record<string, string> = {}
  for (const f of props.fields) {
    if (f.required && (form.value[f.key] === '' || form.value[f.key] == null)) {
      errs[f.key] = `${f.label} wajib diisi`
    }
    if (f.type === 'number' && form.value[f.key] != null && Number(form.value[f.key]) < 0) {
      errs[f.key] = `${f.label} tidak boleh negatif`
    }
  }
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

const swal = useSwal()
const notif = useNotificationStore()

async function submit() {
  errorMsg.value = ''
  if (!validate()) return
  const payload: Record<string, any> = {}
  for (const f of props.fields) {
    let val = form.value[f.key]
    if (val === '') val = undefined
    payload[f.key] = val
  }
  const wasEditing = !!editingId.value
  submitting.value = true
  try {
    if (editingId.value) {
      await useApi(`${props.endpoint}/${editingId.value}`, { method: 'PUT', body: payload })
    } else {
      await useApi(props.endpoint, { method: 'POST', body: payload })
    }
    showModal.value = false
    await load()
    notif.pushToast({
      severity: 'success',
      title: 'Berhasil',
      message: `${props.title} berhasil ${wasEditing ? 'diperbarui' : 'disimpan'}.`,
    })
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menyimpan data'
  } finally {
    submitting.value = false
  }
}

// --- delete ---
async function askDelete(row: any) {
  const label = row.name || row.code || row.sku || ''
  const confirmed = await swal.confirmDelete(label)
  if (!confirmed) return
  try {
    await useApi(`${props.endpoint}/${row.id}`, { method: 'DELETE' })
    await load()
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `${props.title} berhasil dihapus.` })
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal menghapus', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

onMounted(load)
</script>

<template>
  <div class="crud-page">
    <BaseBreadcrumb :items="[{ label: 'Master Data', to: '/master/warehouses' }, { label: title }]" />
    <BasePageHeader :title="title" :count="totalRows">
      <template #actions>
        <BaseButton @click="startCreate">+ Tambah {{ title }}</BaseButton>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="totalRows"
      :search-placeholder="`Cari ${title.toLowerCase()}...`"
      :empty-text="`Belum ada ${title}`"
      empty-icon="🗂️"
      @search-change="onSearchChange"
      @filter-change="onFilterChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <BaseButton size="sm" @click="startCreate">+ Tambah</BaseButton>
      </template>
      <template #empty-action>
        <BaseButton size="sm" @click="startCreate">+ Tambah {{ title }}</BaseButton>
      </template>
      <template #cell-is_active="{ value }">
        <BaseBadge :status="value ? 'active' : 'inactive'">{{ value ? 'Aktif' : 'Nonaktif' }}</BaseBadge>
      </template>
      <template #actions="{ row }">
        <BaseButton variant="ghost" size="sm" @click="startEdit(row)">Edit</BaseButton>
        <BaseButton variant="danger" size="sm" @click="askDelete(row)">Hapus</BaseButton>
      </template>
    </BaseDataTable>

    <BaseModal v-model="showModal" :title="editingId ? `Edit ${title}` : `Tambah ${title}`" size="md">
      <form class="crud-form-grid" @submit.prevent="submit">
        <template v-for="f in fields" :key="f.key">
          <BaseInput
            v-if="!f.type || f.type === 'text'"
            v-model="form[f.key]"
            :label="f.label"
            :required="f.required"
            :error="formErrors[f.key]"
          />
          <BaseNumberInput
            v-else-if="f.type === 'number'"
            v-model="form[f.key]"
            :label="f.label"
            :required="f.required"
            :error="formErrors[f.key]"
          />
          <BaseSearchableSelect
            v-else-if="f.type === 'select'"
            v-model="form[f.key]"
            :label="f.label"
            :options="f.options ?? []"
          />
          <label v-else-if="f.type === 'checkbox'" class="checkbox-field">
            <input v-model="form[f.key]" type="checkbox" />
            {{ f.label }}
          </label>
        </template>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="submitting" @click="showModal = false">Batal</BaseButton>
        <BaseButton :loading="submitting" @click="submit">{{ editingId ? 'Update' : 'Simpan' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.error {
  color: var(--color-danger);
  margin-bottom: 12px;
}
.crud-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  align-self: end;
  padding-bottom: 8px;
}
</style>
