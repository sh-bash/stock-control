<script setup lang="ts">
// Card-list layout is kept as-is (rather than forced into BaseDataTable)
// since each workflow is a nested structure (steps + an inline add-step
// form) that doesn't fit a flat row/column table — but every control now
// uses the base UI kit (BaseButton/BaseBadge/BaseModal/BaseConfirmDialog/
// BaseSelect) for visual consistency with the rest of the app. Workflow
// count is inherently small (one per document_type at most usually), so
// server-side pagination wasn't added here — a plain full list is fine.
interface Role { id: string; name: string }
interface User { id: string; name: string; email: string }
interface Step { id: string; step_order: number; approver_type: 'role' | 'user'; approver_id: string }
interface Workflow { id: string; document_type: string; name: string; is_active: boolean; steps: Step[] }

const DOCUMENT_TYPES = ['po', 'receiving', 'purchase_return', 'so', 'do', 'sale_return', 'adjustment', 'transfer']
const NO_TRIGGER_TYPES = new Set(['so', 'do', 'sale_return', 'transfer'])

const workflows = ref<Workflow[]>([])
const roles = ref<Role[]>([])
const users = ref<User[]>([])
const errorMsg = ref('')
const loading = ref(false)

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

function stepFormFor(workflowId: string) {
  if (!stepForm.value[workflowId]) {
    stepForm.value[workflowId] = { approver_type: 'role', approver_id: '' }
  }
  return stepForm.value[workflowId]
}

// --- create modal ---
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const form = ref({ document_type: 'po', name: '' })

function openCreateModal() {
  form.value = { document_type: 'po', name: '' }
  createError.value = ''
  showCreateModal.value = true
}

async function createWorkflow() {
  createError.value = ''
  creating.value = true
  try {
    await useApi('/approval-workflows', { method: 'POST', body: form.value })
    showCreateModal.value = false
    await loadAll()
  } catch (err: any) {
    createError.value = err?.data?.data?.message || 'Gagal membuat workflow'
  } finally {
    creating.value = false
  }
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

async function toggleActive(wf: Workflow) {
  try {
    await useApi(`/approval-workflows/${wf.id}`, { method: 'PUT', body: { is_active: !wf.is_active } })
    await loadAll()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal update workflow'
  }
}

// --- confirm dialogs (shared for remove-step and remove-workflow) ---
const confirmState = ref<{ show: boolean; title: string; message: string; loading: boolean; run: (() => Promise<void>) | null }>({
  show: false, title: '', message: '', loading: false, run: null,
})
function askRemoveStep(workflowId: string, step: Step) {
  confirmState.value = {
    show: true,
    title: 'Hapus Step?',
    message: `Step ${step.step_order} (${approverLabel(step.approver_type, step.approver_id)}) akan dihapus.`,
    loading: false,
    run: async () => {
      await useApi(`/approval-workflows/${workflowId}/steps/${step.id}`, { method: 'DELETE' })
      await loadAll()
    },
  }
}
function askRemoveWorkflow(wf: Workflow) {
  confirmState.value = {
    show: true,
    title: 'Hapus Workflow?',
    message: `Workflow "${wf.name}" beserta semua step-nya akan dihapus permanen.`,
    loading: false,
    run: async () => {
      await useApi(`/approval-workflows/${wf.id}`, { method: 'DELETE' })
      await loadAll()
    },
  }
}
async function runConfirmedAction() {
  if (!confirmState.value.run) return
  confirmState.value.loading = true
  try {
    await confirmState.value.run()
    confirmState.value.show = false
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Aksi gagal'
    confirmState.value.show = false
  } finally {
    confirmState.value.loading = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="workflow-page">
    <div class="header-row">
      <BaseBreadcrumb :items="[{ label: 'Approval', to: '/approval/inbox' }, { label: 'Approval Workflows' }]" />
      <BasePageHeader title="Approval Workflows" />
      <BaseButton size="sm" @click="openCreateModal">+ Buat Workflow</BaseButton>
    </div>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <p v-if="loading">Memuat...</p>
    <div v-else class="workflow-list">
      <div v-for="wf in workflows" :key="wf.id" class="workflow-card">
        <div class="workflow-header">
          <div class="workflow-title">
            <strong>{{ wf.name }}</strong>
            <BaseBadge tone="neutral">{{ wf.document_type }}</BaseBadge>
            <BaseBadge :status="wf.is_active ? 'active' : 'inactive'" />
            <BaseBadge v-if="NO_TRIGGER_TYPES.has(wf.document_type)" tone="warning">tidak ter-trigger dari UI</BaseBadge>
          </div>
          <div class="workflow-actions">
            <BaseButton variant="ghost" size="sm" @click="toggleActive(wf)">{{ wf.is_active ? 'Nonaktifkan' : 'Aktifkan' }}</BaseButton>
            <BaseButton variant="danger" size="sm" @click="askRemoveWorkflow(wf)">Hapus</BaseButton>
          </div>
        </div>

        <ol class="steps">
          <li v-for="step in wf.steps" :key="step.id">
            <span>Step {{ step.step_order }}: {{ approverLabel(step.approver_type, step.approver_id) }}</span>
            <BaseButton variant="ghost" size="sm" @click="askRemoveStep(wf.id, step)">Hapus</BaseButton>
          </li>
          <li v-if="wf.steps.length === 0" class="empty">Belum ada step</li>
        </ol>

        <div class="add-step">
          <BaseSelect
            v-model="stepFormFor(wf.id).approver_type"
            :options="[{ value: 'role', label: 'Role' }, { value: 'user', label: 'User' }]"
          />
          <BaseSelect
            v-model="stepFormFor(wf.id).approver_id"
            placeholder="-- pilih approver --"
            :options="(stepFormFor(wf.id).approver_type === 'role' ? roles : users).map((o) => ({ value: o.id, label: o.name }))"
          />
          <BaseButton size="sm" @click="addStep(wf.id)">Tambah Step</BaseButton>
        </div>
      </div>
      <p v-if="workflows.length === 0">Belum ada workflow</p>
    </div>

    <BaseModal v-model="showCreateModal" title="Buat Approval Workflow" size="sm">
      <p v-if="createError" class="error">{{ createError }}</p>
      <div class="form-grid">
        <BaseSelect v-model="form.document_type" label="Document Type" :options="DOCUMENT_TYPES.map((dt) => ({ value: dt, label: dt }))" />
        <BaseInput v-model="form.name" label="Workflow Name" required placeholder="e.g. PO Approval 2-Step" />
      </div>
      <p v-if="NO_TRIGGER_TYPES.has(form.document_type)" class="hint">
        ⚠️ Document type ini tidak punya tombol submit/approve di UI transaksinya — workflow ini tidak akan pernah ter-trigger.
      </p>
      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="showCreateModal = false">Batal</BaseButton>
        <BaseButton :loading="creating" @click="createWorkflow">Buat Workflow</BaseButton>
      </template>
    </BaseModal>

    <BaseConfirmDialog
      v-model="confirmState.show"
      :title="confirmState.title"
      :message="confirmState.message"
      confirm-text="Ya, Hapus"
      variant="danger"
      :loading="confirmState.loading"
      @confirm="runConfirmedAction"
    />
  </div>
</template>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.error { color: var(--color-danger); margin-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); background: var(--color-neutral-bg); padding: 8px 10px; border-radius: var(--radius-sm); }
.form-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 12px; }
.workflow-list { display: flex; flex-direction: column; gap: 16px; }
.workflow-card { background: var(--color-surface); padding: 16px; border-radius: var(--radius-md); box-shadow: var(--elevation-1); }
.workflow-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.workflow-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.workflow-actions { display: flex; gap: 4px; }
.steps { margin: 0 0 12px; padding: 0; font-size: 14px; display: flex; flex-direction: column; gap: 4px; list-style: none; }
.steps li { display: flex; align-items: center; justify-content: space-between; }
.steps .empty { color: var(--color-text-muted); }
.add-step { display: flex; gap: 8px; align-items: flex-end; }
</style>
