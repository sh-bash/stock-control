<script setup lang="ts">
interface Role {
  id: string
  name: string
}
interface User {
  id: string
  name: string
}
interface Target {
  id: string
  target_type: 'role' | 'user'
  target_id: string
}
interface Rule {
  id: string
  type: string
  scope_type: string
  scope_id: string | null
  is_active: boolean
  targets: Target[]
}

const NOTIFICATION_TYPES = [
  'min_stock',
  'reorder_point',
  'aging_danger',
  'aging_warning',
  'slow_moving',
  'dead_stock',
  'approval_pending',
]
const SCOPE_TYPES = ['global', 'product', 'category', 'warehouse', 'product_warehouse']

const rules = ref<Rule[]>([])
const roles = ref<Role[]>([])
const users = ref<User[]>([])
const errorMsg = ref('')
const loading = ref(false)

const form = ref({ type: 'min_stock', scope_type: 'global', scope_id: '' })
const targetForm = ref<Record<string, { target_type: 'role' | 'user'; target_id: string }>>({})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [r, roleList, userList] = await Promise.all([
      useApi<Rule[]>('/notifications/rules'),
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

async function createRule() {
  errorMsg.value = ''
  try {
    await useApi('/notifications/rules', {
      method: 'POST',
      body: {
        type: form.value.type,
        scope_type: form.value.scope_type,
        scope_id: form.value.scope_type === 'global' ? null : form.value.scope_id || null,
      },
    })
    form.value = { type: 'min_stock', scope_type: 'global', scope_id: '' }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat rule'
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

async function removeRule(id: string) {
  if (!confirm('Hapus rule ini?')) return
  try {
    await useApi(`/notifications/rules/${id}`, { method: 'DELETE' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus rule'
  }
}

function targetFormFor(ruleId: string) {
  if (!targetForm.value[ruleId]) {
    targetForm.value[ruleId] = { target_type: 'role', target_id: '' }
  }
  return targetForm.value[ruleId]
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

async function removeTarget(ruleId: string, targetId: string) {
  try {
    await useApi(`/notifications/rules/${ruleId}/targets/${targetId}`, { method: 'DELETE' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus target'
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="rules-page">
    <h1>Notification Rules</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createRule">
      <label>
        Type
        <select v-model="form.type">
          <option v-for="t in NOTIFICATION_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label>
        Scope
        <select v-model="form.scope_type">
          <option v-for="s in SCOPE_TYPES" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label v-if="form.scope_type !== 'global'">
        Scope ID (UUID product/category/warehouse)
        <input v-model="form.scope_id" type="text" placeholder="uuid" />
      </label>
      <button type="submit">Buat Rule</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <div v-else class="rule-list">
      <div v-for="rule in rules" :key="rule.id" class="rule-card">
        <div class="rule-header">
          <div>
            <strong>{{ rule.type }}</strong>
            <span class="tag">scope: {{ rule.scope_type }}</span>
            <span v-if="rule.scope_id" class="tag mono">{{ rule.scope_id }}</span>
            <span class="tag" :class="rule.is_active ? 'tag-active' : 'tag-inactive'">
              {{ rule.is_active ? 'active' : 'inactive' }}
            </span>
          </div>
          <div class="rule-actions">
            <button class="link" @click="toggleActive(rule)">{{ rule.is_active ? 'Nonaktifkan' : 'Aktifkan' }}</button>
            <button class="link danger" @click="removeRule(rule.id)">Hapus</button>
          </div>
        </div>

        <ul class="targets">
          <li v-for="t in rule.targets" :key="t.id">
            {{ targetLabel(t) }}
            <button class="link danger" @click="removeTarget(rule.id, t.id)">Hapus</button>
          </li>
          <li v-if="rule.targets.length === 0" class="empty">Belum ada target</li>
        </ul>

        <div class="add-target">
          <select v-model="targetFormFor(rule.id).target_type">
            <option value="role">Role</option>
            <option value="user">User</option>
          </select>
          <select v-model="targetFormFor(rule.id).target_id">
            <option value="">-- pilih target --</option>
            <option
              v-for="opt in targetFormFor(rule.id).target_type === 'role' ? roles : users"
              :key="opt.id"
              :value="opt.id"
            >
              {{ opt.name }}
            </option>
          </select>
          <button @click="addTarget(rule.id)">Tambah Target</button>
        </div>
      </div>
      <p v-if="rules.length === 0">Belum ada rule</p>
    </div>
  </div>
</template>

<style scoped>
.create-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.create-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.create-form input,
.create-form select {
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
}
button.link {
  background: none;
  color: #2563eb;
  padding: 2px 6px;
}
button.link.danger {
  color: #dc2626;
}
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rule-card {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
}
.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.tag {
  margin-left: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e2e8f0;
}
.tag.mono {
  font-family: monospace;
}
.tag-active {
  background: #dcfce7;
  color: #16a34a;
}
.tag-inactive {
  background: #fee2e2;
  color: #dc2626;
}
.targets {
  margin: 0 0 12px 20px;
  padding: 0;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.targets .empty {
  color: #94a3b8;
  list-style: none;
  margin-left: -20px;
}
.add-target {
  display: flex;
  gap: 8px;
}
.error {
  color: #dc2626;
}
</style>
