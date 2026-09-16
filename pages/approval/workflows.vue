<script setup lang="ts">
interface Role {
  id: string
  name: string
}
interface User {
  id: string
  name: string
  email: string
}
interface Step {
  id: string
  step_order: number
  approver_type: 'role' | 'user'
  approver_id: string
}
interface Workflow {
  id: string
  document_type: string
  name: string
  is_active: boolean
  steps: Step[]
}

const DOCUMENT_TYPES = ['po', 'receiving', 'purchase_return', 'so', 'do', 'sale_return', 'adjustment', 'transfer']

const workflows = ref<Workflow[]>([])
const roles = ref<Role[]>([])
const users = ref<User[]>([])
const errorMsg = ref('')
const loading = ref(false)

const form = ref({ document_type: 'po', name: '' })
const stepForm = ref<Record<string, { approver_type: 'role' | 'user'; approver_id: string }>>({})

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [wf, r, u] = await Promise.all([
      useApi<Workflow[]>('/approval-workflows'),
      useApi<Role[]>('/roles'),
      useApi<User[]>('/users'),
    ])
    workflows.value = wf
    roles.value = r
    users.value = u
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function approverLabel(type: string, id: string) {
  if (type === 'role') return `Role: ${roles.value.find((r) => r.id === id)?.name || id}`
  return `User: ${users.value.find((u) => u.id === id)?.name || id}`
}

async function createWorkflow() {
  errorMsg.value = ''
  try {
    await useApi('/approval-workflows', { method: 'POST', body: form.value })
    form.value = { document_type: 'po', name: '' }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat workflow'
  }
}

function stepFormFor(workflowId: string) {
  if (!stepForm.value[workflowId]) {
    stepForm.value[workflowId] = { approver_type: 'role', approver_id: '' }
  }
  return stepForm.value[workflowId]
}

async function addStep(workflowId: string) {
  errorMsg.value = ''
  const f = stepFormFor(workflowId)
  if (!f.approver_id) {
    errorMsg.value = 'Pilih approver dulu'
    return
  }
  try {
    await useApi(`/approval-workflows/${workflowId}/steps`, { method: 'POST', body: f })
    stepForm.value[workflowId] = { approver_type: 'role', approver_id: '' }
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menambah step'
  }
}

async function removeStep(workflowId: string, stepId: string) {
  if (!confirm('Hapus step ini?')) return
  try {
    await useApi(`/approval-workflows/${workflowId}/steps/${stepId}`, { method: 'DELETE' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus step'
  }
}

async function toggleActive(wf: Workflow) {
  try {
    await useApi(`/approval-workflows/${wf.id}`, { method: 'PUT', body: { is_active: !wf.is_active } })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal update workflow'
  }
}

async function removeWorkflow(id: string) {
  if (!confirm('Hapus workflow ini?')) return
  try {
    await useApi(`/approval-workflows/${id}`, { method: 'DELETE' })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus workflow'
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="workflow-page">
    <h1>Approval Workflows</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <form class="create-form" @submit.prevent="createWorkflow">
      <label>
        Document Type
        <select v-model="form.document_type">
          <option v-for="dt in DOCUMENT_TYPES" :key="dt" :value="dt">{{ dt }}</option>
        </select>
      </label>
      <label>
        Workflow Name
        <input v-model="form.name" type="text" required placeholder="e.g. PO Approval 2-Step" />
      </label>
      <button type="submit">Buat Workflow</button>
    </form>

    <p v-if="loading">Memuat...</p>
    <div v-else class="workflow-list">
      <div v-for="wf in workflows" :key="wf.id" class="workflow-card">
        <div class="workflow-header">
          <div>
            <strong>{{ wf.name }}</strong>
            <span class="tag">{{ wf.document_type }}</span>
            <span class="tag" :class="wf.is_active ? 'tag-active' : 'tag-inactive'">
              {{ wf.is_active ? 'active' : 'inactive' }}
            </span>
          </div>
          <div class="workflow-actions">
            <button class="link" @click="toggleActive(wf)">{{ wf.is_active ? 'Nonaktifkan' : 'Aktifkan' }}</button>
            <button class="link danger" @click="removeWorkflow(wf.id)">Hapus</button>
          </div>
        </div>

        <ol class="steps">
          <li v-for="step in wf.steps" :key="step.id">
            Step {{ step.step_order }}: {{ approverLabel(step.approver_type, step.approver_id) }}
            <button class="link danger" @click="removeStep(wf.id, step.id)">Hapus</button>
          </li>
          <li v-if="wf.steps.length === 0" class="empty">Belum ada step</li>
        </ol>

        <div class="add-step">
          <select v-model="stepFormFor(wf.id).approver_type">
            <option value="role">Role</option>
            <option value="user">User</option>
          </select>
          <select v-model="stepFormFor(wf.id).approver_id">
            <option value="">-- pilih approver --</option>
            <option
              v-for="opt in stepFormFor(wf.id).approver_type === 'role' ? roles : users"
              :key="opt.id"
              :value="opt.id"
            >
              {{ opt.name }}
            </option>
          </select>
          <button @click="addStep(wf.id)">Tambah Step</button>
        </div>
      </div>
      <p v-if="workflows.length === 0">Belum ada workflow</p>
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
.workflow-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.workflow-card {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
}
.workflow-header {
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
.tag-active {
  background: #dcfce7;
  color: #16a34a;
}
.tag-inactive {
  background: #fee2e2;
  color: #dc2626;
}
.steps {
  margin: 0 0 12px 20px;
  padding: 0;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.steps .empty {
  color: #94a3b8;
  list-style: none;
  margin-left: -20px;
}
.add-step {
  display: flex;
  gap: 8px;
}
.add-step select {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.error {
  color: #dc2626;
}
</style>
