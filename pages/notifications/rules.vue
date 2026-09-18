<script setup lang="ts">
// Same rationale as approval/workflows.vue: card layout kept (nested
// targets + inline add-target form don't fit a flat table), but every
// control now uses the base UI kit. Rule count is small, so no server
// pagination here.
interface Role { id: string; name: string }
interface User { id: string; name: string }
interface Target { id: string; target_type: 'role' | 'user'; target_id: string }
interface Rule { id: string; type: string; scope_type: string; scope_id: string | null; is_active: boolean; targets: Target[] }

const NOTIFICATION_TYPES = ['min_stock', 'reorder_point', 'aging_danger', 'aging_warning', 'slow_moving', 'dead_stock', 'approval_pending']
const SCOPE_TYPES = ['global', 'product', 'category', 'warehouse', 'product_warehouse']

const rules = ref<Rule[]>([])
const roles = ref<Role[]>([])
const users = ref<User[]>([])
const errorMsg = ref('')
const loading = ref(false)

const targetForm = ref<Record<string, { target_type: 'role' | 'user'; target_id: string }>>({})

const { filters, setFilter, removeFilter, resetAll, activeCount } = useTableFilters(
  [{ key: 'type' }, { key: 'scope_type' }],
  () => loadAll(),
)

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (filters.type) chips.push({ key: 'type', label: `Type: ${filters.type}` })
  if (filters.scope_type) chips.push({ key: 'scope_type', label: `Scope Type: ${filters.scope_type}` })
  return chips
})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams()
    if (filters.type) params.set('type', filters.type)
    if (filters.scope_type) params.set('scope_type', filters.scope_type)
    const [r, roleList, userList] = await Promise.all([
      useApi<Rule[]>(`/notifications/rules?${params.toString()}`),
      useApi<Role[]>('/roles'),
      useApi<User[]>('/users'),
    ])
    rules.value = r
    roles.value = roleList
    users.value = userList
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function targetLabel(t: Target) {
  if (t.target_type === 'role') return `Role: ${roles.value.find((r) => r.id === t.target_id)?.name || t.target_id}`
  return `User: ${users.value.find((u) => u.id === t.target_id)?.name || t.target_id}`
}

function targetFormFor(ruleId: string) {
  if (!targetForm.value[ruleId]) {
    targetForm.value[ruleId] = { target_type: 'role', target_id: '' }
  }
  return targetForm.value[ruleId]
}

// --- create modal ---
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const form = ref({ type: 'min_stock', scope_type: 'global', scope_id: '' })

function openCreateModal() {
  form.value = { type: 'min_stock', scope_type: 'global', scope_id: '' }
  createError.value = ''
  showCreateModal.value = true
}

async function createRule() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/notifications/rules', {
      method: 'POST',
      body: {
        type: form.value.type,
        scope_type: form.value.scope_type,
        scope_id: form.value.scope_type === 'global' ? null : form.value.scope_id || null,
      },
    })
    showCreateModal.value = false
    await loadAll()
    useNotificationStore().pushToast({ severity: 'success', title: 'Berhasil', message: 'Notification Rule berhasil dibuat.' })
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat rule'
  } finally {
    creating.value = false
  }
}

async function toggleActive(rule: Rule) {
  try {
    await useApi(`/notifications/rules/${rule.id}`, { method: 'PUT', body: { is_active: !rule.is_active } })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal update rule'
  }
}

async function addTarget(ruleId: string) {
  errorMsg.value = ''
  const f = targetFormFor(ruleId)
  if (!f.target_id) {
    errorMsg.value = 'Pilih target dulu'
    return
  }
  try {
    await useApi(`/notifications/rules/${ruleId}/targets`, { method: 'POST', body: f })
    targetForm.value[ruleId] = { target_type: 'role', target_id: '' }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menambah target'
  }
}

// --- delete confirms (SweetAlert2, see composables/useSwal.ts) ---
const swal = useSwal()
const notif = useNotificationStore()

async function askRemoveTarget(ruleId: string, target: Target) {
  const confirmed = await swal.confirmDelete(targetLabel(target))
  if (!confirmed) return
  try {
    await useApi(`/notifications/rules/${ruleId}/targets/${target.id}`, { method: 'DELETE' })
    await loadAll()
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Target berhasil dihapus.' })
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal menghapus', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}
async function askRemoveRule(rule: Rule) {
  const confirmed = await swal.confirmDelete(`Rule "${rule.type}" (scope: ${rule.scope_type}) beserta semua target-nya`)
  if (!confirmed) return
  try {
    await useApi(`/notifications/rules/${rule.id}`, { method: 'DELETE' })
    await loadAll()
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Rule berhasil dihapus.' })
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal menghapus', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="rules-page">
    <div class="header-row">
      <BaseBreadcrumb :items="[{ label: 'Approval & Settings' }, { label: 'Notification Rules' }]" />
      <BasePageHeader title="Notification Rules" />
      <BaseButton size="sm" @click="openCreateModal">+ Buat Rule</BaseButton>
    </div>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" inline @remove-chip="removeFilter" @reset="resetAll">
      <BaseSelect
        label="Type"
        :model-value="filters.type"
        :options="NOTIFICATION_TYPES.map((t) => ({ value: t, label: t }))"
        @update:model-value="(v) => setFilter('type', v)"
      />
      <BaseSelect
        label="Scope Type"
        :model-value="filters.scope_type"
        :options="SCOPE_TYPES.map((s) => ({ value: s, label: s }))"
        @update:model-value="(v) => setFilter('scope_type', v)"
      />
    </BaseFilterPanel>

    <p v-if="loading">Memuat...</p>
    <div v-else class="rule-list">
      <div v-for="rule in rules" :key="rule.id" class="rule-card">
        <div class="rule-header">
          <div class="rule-title">
            <strong>{{ rule.type }}</strong>
            <BaseBadge tone="neutral">scope: {{ rule.scope_type }}</BaseBadge>
            <BaseBadge v-if="rule.scope_id" tone="neutral"><span class="mono">{{ rule.scope_id }}</span></BaseBadge>
            <BaseBadge :status="rule.is_active ? 'active' : 'inactive'" />
          </div>
          <div class="rule-actions">
            <BaseButton variant="ghost" size="sm" @click="toggleActive(rule)">{{ rule.is_active ? 'Nonaktifkan' : 'Aktifkan' }}</BaseButton>
            <BaseButton variant="danger" size="sm" @click="askRemoveRule(rule)">Hapus</BaseButton>
          </div>
        </div>

        <ul class="targets">
          <li v-for="t in rule.targets" :key="t.id">
            <span>{{ targetLabel(t) }}</span>
            <BaseButton variant="ghost" size="sm" @click="askRemoveTarget(rule.id, t)">Hapus</BaseButton>
          </li>
          <li v-if="rule.targets.length === 0" class="empty">Belum ada target</li>
        </ul>

        <div class="add-target">
          <BaseSelect v-model="targetFormFor(rule.id).target_type" :options="[{ value: 'role', label: 'Role' }, { value: 'user', label: 'User' }]" />
          <BaseSearchableSelect
            v-model="targetFormFor(rule.id).target_id"
            placeholder="Cari role/user..."
            :options="(targetFormFor(rule.id).target_type === 'role' ? roles : users).map((o) => ({ value: o.id, label: o.name }))"
          />
          <BaseButton size="sm" @click="addTarget(rule.id)">Tambah Target</BaseButton>
        </div>
      </div>
      <p v-if="rules.length === 0">Belum ada rule</p>
    </div>

    <BaseModal v-model="showCreateModal" title="Buat Notification Rule" size="sm">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.type" label="Type" :options="NOTIFICATION_TYPES.map((t) => ({ value: t, label: t }))" />
        <BaseSelect v-model="form.scope_type" label="Scope" :options="SCOPE_TYPES.map((s) => ({ value: s, label: s }))" />
        <BaseInput v-if="form.scope_type !== 'global'" v-model="form.scope_id" label="Scope ID (UUID product/category/warehouse)" placeholder="uuid" />
      </div>
      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" @click="createRule">Buat Rule</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.error { color: var(--color-danger); margin-bottom: 12px; }
.form-grid { display: flex; flex-direction: column; gap: 14px; }
.rule-list { display: flex; flex-direction: column; gap: 16px; }
.rule-card { background: var(--color-surface); padding: 16px; border-radius: var(--radius-md); box-shadow: var(--elevation-1); }
.rule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.rule-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rule-actions { display: flex; gap: 4px; }
.mono { font-family: monospace; }
.targets { margin: 0 0 12px; padding: 0; font-size: 14px; display: flex; flex-direction: column; gap: 4px; list-style: none; }
.targets li { display: flex; align-items: center; justify-content: space-between; }
.targets .empty { color: var(--color-text-muted); }
.add-target { display: flex; gap: 8px; align-items: flex-end; }
</style>
