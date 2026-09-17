<script setup lang="ts">
interface Instance {
  id: string
  workflow_id: string
  document_type: string
  document_id: string
  current_step: number
  status: string
  created_at: string
}

const DOCUMENT_TYPES = ['po', 'receiving', 'purchase_return', 'so', 'do', 'sale_return', 'adjustment', 'transfer']
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const rows = ref<Instance[]>([])
const totalRows = ref(0)
const errorMsg = ref('')
const loading = ref(false)
const submitDocType = ref('po')
const submitting = ref(false)
const noteMap = ref<Record<string, string>>({})

const page = ref(1)
const pageSize = 20
const statusFilter = ref('')
const docTypeFilter = ref('')
const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'created_at', direction: 'desc' })

const columns = [
  {
    key: 'document_type',
    label: 'Document Type',
    filterOptions: DOCUMENT_TYPES.map((dt) => ({ value: dt, label: dt })),
  },
  { key: 'document_id', label: 'Document ID' },
  { key: 'current_step', label: 'Current Step' },
  { key: 'status', label: 'Status', filterOptions: STATUS_OPTIONS },
]

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (docTypeFilter.value) params.set('document_type', docTypeFilter.value)
    if (sort.value.direction) {
      params.set('sortBy', sort.value.key)
      params.set('sortDir', sort.value.direction)
    }
    const res = await useApiEnvelope<Instance[]>(`/approvals?${params.toString()}`)
    rows.value = res.data
    totalRows.value = Number(res.meta?.totalRows ?? res.data.length)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function onFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'status') statusFilter.value = value
  if (key === 'document_type') docTypeFilter.value = value
  page.value = 1
  load()
}
function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  sort.value = s
  load()
}
function onPageChange(p: number) {
  page.value = p
  load()
}

async function submitDummy() {
  errorMsg.value = ''
  submitting.value = true
  try {
    await useApi('/approvals/test-submit', { method: 'POST', body: { document_type: submitDocType.value } })
    page.value = 1
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal submit dokumen dummy'
  } finally {
    submitting.value = false
  }
}

// --- confirm dialog (approve/reject share one) ---
const confirmState = ref<{ show: boolean; title: string; message: string; confirmText: string; variant: 'primary' | 'danger'; loading: boolean; run: (() => Promise<void>) | null }>({
  show: false, title: '', message: '', confirmText: '', variant: 'primary', loading: false, run: null,
})
function askAction(inst: Instance, action: 'approve' | 'reject') {
  const note = noteMap.value[inst.id] || ''
  confirmState.value = {
    show: true,
    title: action === 'approve' ? 'Approve Dokumen?' : 'Reject Dokumen?',
    message: `${inst.document_type.toUpperCase()} (${inst.document_id.slice(0, 8)}...) akan di-${action}.${note ? ` Catatan: "${note}"` : ''}`,
    confirmText: action === 'approve' ? 'Ya, Approve' : 'Ya, Reject',
    variant: action === 'approve' ? 'primary' : 'danger',
    loading: false,
    run: async () => {
      await useApi(`/approvals/${inst.id}/${action}`, { method: 'POST', body: { note } })
      await load()
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

onMounted(load)
</script>

<template>
  <div class="inbox-page">
    <h1>Approval Inbox</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <BaseDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="totalRows"
      :searchable="false"
      @filter-change="onFilterChange"
      @sort-change="onSortChange"
      @update:page="onPageChange"
    >
      <template #toolbar-actions>
        <div class="submit-box">
          <BaseSelect v-model="submitDocType" :options="DOCUMENT_TYPES.map((dt) => ({ value: dt, label: dt }))" />
          <BaseButton size="sm" variant="secondary" :loading="submitting" @click="submitDummy">Submit Dokumen Dummy</BaseButton>
        </div>
      </template>
      <template #cell-document_id="{ value }"><span class="mono">{{ value.slice(0, 8) }}...</span></template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <template v-if="row.status === 'pending'">
          <input v-model="noteMap[row.id]" class="note-input" type="text" placeholder="Catatan (opsional)" />
          <BaseButton size="sm" @click="askAction(row, 'approve')">Approve</BaseButton>
          <BaseButton variant="danger" size="sm" @click="askAction(row, 'reject')">Reject</BaseButton>
        </template>
      </template>
    </BaseDataTable>

    <BaseConfirmDialog
      v-model="confirmState.show"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-text="confirmState.confirmText"
      :variant="confirmState.variant"
      :loading="confirmState.loading"
      @confirm="runConfirmedAction"
    />
  </div>
</template>

<style scoped>
.error { color: var(--color-danger); margin-bottom: 12px; }
.submit-box { display: flex; align-items: center; gap: 8px; }
.mono { font-family: monospace; }
.note-input {
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 140px;
  font-size: 12px;
  margin-right: 4px;
}
</style>
