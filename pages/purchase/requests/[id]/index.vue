<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const swal = useSwal()
const notif = useNotificationStore()
const { loadMasters, productLabel } = useMasters()

const req = ref<any>(null)
const errorMsg = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    req.value = await useApi(`/product-requests/${id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat request'
  } finally {
    loading.value = false
  }
}

const canEdit = computed(() => ['draft', 'rejected'].includes(req.value?.status))
const canCompare = computed(() => ['approved', 'comparing'].includes(req.value?.status))
const canOrder = computed(() => ['approved', 'comparing', 'ordered'].includes(req.value?.status))

async function act(action: 'submit' | 'approve' | 'reject') {
  const r = req.value
  const confirmed =
    action === 'approve'
      ? await swal.confirmApprove(`Request <strong>${r.no_request}</strong> akan disetujui.`)
      : action === 'reject'
        ? await swal.confirmReject(`Request <strong>${r.no_request}</strong> akan ditolak.`)
        : await swal.confirmAction({
            title: 'Submit request?',
            message: r.needs_approval
              ? `Request <strong>${r.no_request}</strong> akan dikirim untuk persetujuan.`
              : `Request <strong>${r.no_request}</strong> tidak perlu approval dan akan langsung disetujui.`,
            confirmText: 'Ya, Submit',
          })
  if (!confirmed) return
  try {
    await useApi(`/product-requests/${id}/${action}`, { method: 'POST' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `Request ${r.no_request}: ${action} berhasil.` })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Aksi gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

async function remove() {
  if (!(await swal.confirmDelete(req.value.no_request))) return
  try {
    await useApi(`/product-requests/${id}`, { method: 'DELETE' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Request dihapus.' })
    await router.push('/purchase/requests')
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal menghapus', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

onMounted(async () => {
  await loadMasters(['users', 'products'])
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Product Request', to: '/purchase/requests' }, { label: req?.no_request ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="req">
      <BasePageHeader :title="req.title" :description="req.no_request">
        <template #actions>
          <div class="doc-actions">
            <BaseBadge :status="req.status" />
            <template v-if="canEdit">
              <NuxtLink :to="`/purchase/requests/${id}/edit`"><BaseButton variant="secondary" size="sm">Ubah</BaseButton></NuxtLink>
              <BaseButton size="sm" @click="act('submit')">Submit</BaseButton>
              <BaseButton v-if="req.status === 'draft'" variant="danger" size="sm" @click="remove">Hapus</BaseButton>
            </template>
            <template v-if="req.status === 'waiting_approval'">
              <BaseButton size="sm" @click="act('approve')">Approve</BaseButton>
              <BaseButton variant="danger" size="sm" @click="act('reject')">Reject</BaseButton>
            </template>
            <NuxtLink v-if="canCompare" :to="`/purchase/comparisons/new?request_id=${id}`"><BaseButton size="sm">Buat Comparison</BaseButton></NuxtLink>
            <NuxtLink v-if="canOrder" :to="`/purchase/orders/new?request_id=${id}`"><BaseButton variant="secondary" size="sm">Buat PO</BaseButton></NuxtLink>
          </div>
        </template>
      </BasePageHeader>

      <div class="doc-layout">
        <div>
          <section class="doc-card">
            <dl class="doc-meta">
              <div><dt>Peminta</dt><dd>{{ req.requested_by_name ?? '-' }}</dd></div>
              <div><dt>Dibutuhkan</dt><dd>{{ req.needed_date ?? '-' }}</dd></div>
              <div><dt>Approval</dt><dd>{{ req.needs_approval ? 'Perlu approval' : 'Tanpa approval' }}</dd></div>
              <div><dt>Dibuat</dt><dd>{{ new Date(req.created_at).toLocaleDateString('id-ID') }}</dd></div>
            </dl>
            <p v-if="req.notes" class="notes">{{ req.notes }}</p>
          </section>

          <section class="doc-card">
            <h2>Item</h2>
            <table class="doc-table">
              <thead><tr><th>Produk</th><th class="num">Qty</th><th>Satuan</th><th>Spesifikasi</th><th>Catatan</th></tr></thead>
              <tbody>
                <tr v-for="i in req.items" :key="i.id">
                  <td>
                    {{ i.name }}
                    <div v-if="i.product_id" class="muted small">Master: {{ productLabel(i.product_id) }}</div>
                  </td>
                  <td class="num">{{ formatQty(i.qty) }}</td>
                  <td>{{ i.unit || '-' }}</td>
                  <td>{{ i.spec || '-' }}</td>
                  <td>{{ i.notes || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="doc-card">
            <h2>Product Comparison</h2>
            <p v-if="!req.comparisons.length" class="muted">Belum ada comparison untuk request ini.</p>
            <ul v-else class="plain">
              <li v-for="c in req.comparisons" :key="c.id">
                <NuxtLink :to="`/purchase/comparisons/${c.id}`" class="link-cell">{{ c.no_comparison }}</NuxtLink>
                <BaseBadge :status="c.status" />
              </li>
            </ul>
          </section>
        </div>

        <CommentsPanel ref-type="request" :ref-id="id" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.notes { margin: 12px 0 0; font-size: 13px; white-space: pre-wrap; }
.small { font-size: 11px; }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.plain li { display: flex; gap: 8px; align-items: center; }
</style>
