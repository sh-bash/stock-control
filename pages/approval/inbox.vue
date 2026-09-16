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

const instances = ref<Instance[]>([])
const errorMsg = ref('')
const loading = ref(false)
const submitDocType = ref('po')
const noteMap = ref<Record<string, string>>({})

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    instances.value = await useApi<Instance[]>('/approvals')
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

async function submitDummy() {
  errorMsg.value = ''
  try {
    await useApi('/approvals/test-submit', { method: 'POST', body: { document_type: submitDocType.value } })
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal submit dokumen dummy'
  }
}

async function approve(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/approvals/${id}/approve`, { method: 'POST', body: { note: noteMap.value[id] || '' } })
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal approve'
  }
}

async function reject(id: string) {
  errorMsg.value = ''
  try {
    await useApi(`/approvals/${id}/reject`, { method: 'POST', body: { note: noteMap.value[id] || '' } })
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal reject'
  }
}

function statusClass(status: string) {
  return `status status-${status}`
}

onMounted(load)
</script>

<template>
  <div class="inbox-page">
    <h1>Approval Inbox</h1>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div class="submit-box">
      <select v-model="submitDocType">
        <option v-for="dt in DOCUMENT_TYPES" :key="dt" :value="dt">{{ dt }}</option>
      </select>
      <button @click="submitDummy">Submit Dokumen Dummy</button>
      <span class="hint">Testing: buat dokumen dummy baru untuk masuk approval flow</span>
    </div>

    <p v-if="loading">Memuat...</p>
    <table v-else class="instance-table">
      <thead>
        <tr>
          <th>Document Type</th>
          <th>Document ID</th>
          <th>Current Step</th>
          <th>Status</th>
          <th>Note</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="inst in instances" :key="inst.id">
          <td>{{ inst.document_type }}</td>
          <td class="mono">{{ inst.document_id.slice(0, 8) }}...</td>
          <td>{{ inst.current_step }}</td>
          <td><span :class="statusClass(inst.status)">{{ inst.status }}</span></td>
          <td>
            <input v-model="noteMap[inst.id]" type="text" placeholder="Catatan (opsional)" />
          </td>
          <td>
            <template v-if="inst.status === 'pending'">
              <button class="approve" @click="approve(inst.id)">Approve</button>
              <button class="reject" @click="reject(inst.id)">Reject</button>
            </template>
          </td>
        </tr>
        <tr v-if="instances.length === 0">
          <td colspan="6">Belum ada approval instance</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.submit-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 14px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.submit-box select {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.hint {
  font-size: 12px;
  color: #64748b;
}
.instance-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.instance-table th,
.instance-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}
.mono {
  font-family: monospace;
}
input {
  padding: 4px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  width: 160px;
}
button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #fff;
  margin-right: 4px;
}
button.approve {
  background: #16a34a;
}
button.reject {
  background: #dc2626;
}
.status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.status-pending {
  background: #fef3c7;
  color: #b45309;
}
.status-approved {
  background: #dcfce7;
  color: #16a34a;
}
.status-rejected {
  background: #fee2e2;
  color: #dc2626;
}
.error {
  color: #dc2626;
}
</style>
