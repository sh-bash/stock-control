<script setup lang="ts">
const id = useRoute().params.id as string
const swal = useSwal()
const notif = useNotificationStore()
const { loadMasters, productLabel, warehouseName } = useMasters()

const ret = ref<any>(null)
const receivingNo = ref('')
const loading = ref(true)
const errorMsg = ref('')

async function load() {
  try {
    ret.value = await useApi(`/purchase-returns/${id}`)
    const rcv: any = await useApi(`/receivings/${ret.value.receiving_id}`)
    receivingNo.value = rcv.no_receiving
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat purchase return'
  } finally {
    loading.value = false
  }
}

async function act(action: 'submit' | 'approve' | 'reject') {
  const r = ret.value
  const confirmed =
    action === 'approve'
      ? await swal.confirmApprove(`<strong>${r.no_return}</strong> akan disetujui — qty layer terkait akan berkurang.`)
      : action === 'reject'
        ? await swal.confirmReject(`<strong>${r.no_return}</strong> akan ditolak.`)
        : await swal.confirmAction({ title: 'Submit Purchase Return?', message: `<strong>${r.no_return}</strong> akan dikirim untuk persetujuan.`, confirmText: 'Ya, Submit' })
  if (!confirmed) return
  try {
    await useApi(`/purchase-returns/${id}/${action}`, { method: 'POST' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `${r.no_return}: ${action} berhasil.` })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Aksi gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

onMounted(async () => {
  await loadMasters(['products', 'warehouses'])
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Purchase Returns', to: '/purchase/returns' }, { label: ret?.no_return ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="ret">
      <BasePageHeader :title="ret.no_return" :description="`Receiving ${receivingNo}`">
        <template #actions>
          <div class="doc-actions">
            <BaseBadge :status="ret.status" />
            <BaseButton v-if="ret.status === 'draft'" size="sm" @click="act('submit')">Submit</BaseButton>
            <template v-if="ret.status === 'waiting_approval'">
              <BaseButton size="sm" @click="act('approve')">Approve</BaseButton>
              <BaseButton variant="danger" size="sm" @click="act('reject')">Reject</BaseButton>
            </template>
          </div>
        </template>
      </BasePageHeader>

      <ReturnWarnings v-if="ret.status !== 'approved'" :receiving-id="ret.receiving_id" />

      <section class="doc-card">
        <dl class="doc-meta">
          <div><dt>Receiving</dt><dd><NuxtLink :to="`/purchase/receivings/${ret.receiving_id}`" class="link-cell">{{ receivingNo }}</NuxtLink></dd></div>
          <div><dt>Warehouse</dt><dd>{{ warehouseName(ret.warehouse_id) }}</dd></div>
          <div><dt>Tanggal Retur</dt><dd>{{ ret.return_date }}</dd></div>
          <div><dt>Alasan</dt><dd>{{ ret.reason || '-' }}</dd></div>
        </dl>
      </section>

      <section class="doc-card">
        <h2>Item</h2>
        <table class="doc-table">
          <thead><tr><th>Produk</th><th class="num">Qty retur</th></tr></thead>
          <tbody>
            <tr v-for="i in ret.items" :key="i.id">
              <td>{{ productLabel(i.product_id) }}</td>
              <td class="num">{{ formatQty(i.qty_return) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
