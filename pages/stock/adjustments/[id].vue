<script setup lang="ts">
const id = useRoute().params.id as string
const swal = useSwal()
const notif = useNotificationStore()
const { loadMasters, warehouseName, productLabel } = useMasters()

const adj = ref<any>(null)
const loading = ref(true)
const errorMsg = ref('')

async function load() {
  try {
    adj.value = await useApi(`/stock-adjustments/${id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat adjustment'
  } finally {
    loading.value = false
  }
}

async function act(action: 'submit' | 'approve' | 'reject') {
  const a = adj.value
  const confirmed =
    action === 'approve'
      ? await swal.confirmApprove(`<strong>${a.no_adjustment}</strong> akan disetujui dan langsung mengubah stok.`)
      : action === 'reject'
        ? await swal.confirmReject(`<strong>${a.no_adjustment}</strong> akan ditolak.`)
        : await swal.confirmAction({ title: 'Submit Adjustment?', message: `<strong>${a.no_adjustment}</strong> akan dikirim untuk persetujuan.`, confirmText: 'Ya, Submit' })
  if (!confirmed) return
  try {
    await useApi(`/stock-adjustments/${id}/${action}`, { method: 'POST' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `${a.no_adjustment}: ${action} berhasil.` })
    await load()
  } catch (err: any) {
    if (action === 'approve') await swal.criticalError(err?.data?.data?.message || 'Terjadi kesalahan', 'Approve Gagal')
    else notif.pushToast({ severity: 'danger', title: 'Aksi gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

onMounted(async () => {
  await loadMasters(['warehouses', 'products'])
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Adjustments', to: '/stock/adjustments' }, { label: adj?.no_adjustment ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="adj">
      <BasePageHeader :title="adj.no_adjustment">
        <template #actions>
          <div class="doc-actions">
            <BaseBadge :status="adj.status" />
            <BaseButton v-if="adj.status === 'draft'" size="sm" @click="act('submit')">Submit</BaseButton>
            <template v-if="adj.status === 'waiting_approval'">
              <BaseButton size="sm" @click="act('approve')">Approve</BaseButton>
              <BaseButton variant="danger" size="sm" @click="act('reject')">Reject</BaseButton>
            </template>
          </div>
        </template>
      </BasePageHeader>
      <section class="doc-card">
        <dl class="doc-meta">
          <div><dt>Warehouse</dt><dd>{{ warehouseName(adj.warehouse_id) }}</dd></div>
          <div><dt>Tanggal</dt><dd>{{ adj.adjustment_date }}</dd></div>
          <div><dt>Alasan</dt><dd>{{ adj.reason || '-' }}</dd></div>
        </dl>
      </section>
      <section class="doc-card">
        <h2>Item</h2>
        <table class="doc-table">
          <thead><tr><th>Produk</th><th class="num">Qty +/-</th><th class="num">HPP</th></tr></thead>
          <tbody>
            <tr v-for="i in adj.items" :key="i.id">
              <td>{{ productLabel(i.product_id) }}</td>
              <td class="num" :style="{ color: Number(i.qty_diff) < 0 ? 'var(--color-danger)' : 'var(--color-normal)' }">{{ Number(i.qty_diff) > 0 ? '+' : '' }}{{ formatQty(i.qty_diff) }}</td>
              <td class="num">{{ i.hpp ? formatNumber(i.hpp) : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
