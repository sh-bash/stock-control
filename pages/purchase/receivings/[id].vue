<script setup lang="ts">
const id = useRoute().params.id as string
const swal = useSwal()
const notif = useNotificationStore()
const { loadMasters, warehouseName, productLabel } = useMasters()

const rcv = ref<any>(null)
const shipmentNo = ref('')
const loading = ref(true)
const errorMsg = ref('')

async function load() {
  try {
    rcv.value = await useApi(`/receivings/${id}`)
    const shp: any = await useApi(`/shipments/${rcv.value.shipment_id}`)
    shipmentNo.value = shp.no_shipment
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat receiving'
  } finally {
    loading.value = false
  }
}

async function act(action: 'submit' | 'approve' | 'reject') {
  const r = rcv.value
  const confirmed =
    action === 'approve'
      ? await swal.confirmApprove(`Receiving <strong>${r.no_receiving}</strong> akan disetujui — stok akan bertambah.`)
      : action === 'reject'
        ? await swal.confirmReject(`Receiving <strong>${r.no_receiving}</strong> akan ditolak.`)
        : await swal.confirmAction({ title: 'Submit Receiving?', message: `Receiving <strong>${r.no_receiving}</strong> akan dikirim untuk persetujuan.`, confirmText: 'Ya, Submit' })
  if (!confirmed) return
  try {
    await useApi(`/receivings/${id}/${action}`, { method: 'POST' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `Receiving ${r.no_receiving}: ${action} berhasil.` })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Aksi gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

onMounted(async () => {
  await loadMasters(['warehouses', 'products'])
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Receivings', to: '/purchase/receivings' }, { label: rcv?.no_receiving ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="rcv">
      <BasePageHeader :title="rcv.no_receiving" :description="`Shipment ${shipmentNo}`">
        <template #actions>
          <div class="doc-actions">
            <BaseBadge :status="rcv.status" />
            <BaseButton v-if="rcv.status === 'draft'" size="sm" @click="act('submit')">Submit</BaseButton>
            <template v-if="rcv.status === 'waiting_approval'">
              <BaseButton size="sm" @click="act('approve')">Approve</BaseButton>
              <BaseButton variant="danger" size="sm" @click="act('reject')">Reject</BaseButton>
            </template>
            <NuxtLink v-if="rcv.status === 'approved'" :to="`/purchase/returns/new?receiving_id=${id}`">
              <BaseButton variant="secondary" size="sm">Buat Purchase Return</BaseButton>
            </NuxtLink>
          </div>
        </template>
      </BasePageHeader>

      <div class="doc-layout">
        <div>
          <section class="doc-card">
            <dl class="doc-meta">
              <div><dt>Shipment</dt><dd><NuxtLink :to="`/purchase/shipments/${rcv.shipment_id}`" class="link-cell">{{ shipmentNo }}</NuxtLink></dd></div>
              <div><dt>Warehouse</dt><dd>{{ warehouseName(rcv.warehouse_id) }}</dd></div>
              <div><dt>Tanggal Terima</dt><dd>{{ rcv.receive_date }}</dd></div>
            </dl>
          </section>

          <section class="doc-card">
            <h2>Item</h2>
            <div class="table-scroll">
              <table class="doc-table">
                <thead><tr><th>Produk</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Ongkir / unit</th><th class="num">HPP</th></tr></thead>
                <tbody>
                  <tr v-for="i in rcv.items" :key="i.id">
                    <td>{{ productLabel(i.product_id) }}</td>
                    <td class="num">{{ formatQty(i.qty_received) }}</td>
                    <td class="num">{{ formatNumber(i.unit_price) }}</td>
                    <td class="num">{{ formatNumber(i.shipping_cost_per_unit) }}</td>
                    <td class="num"><strong>{{ formatNumber(i.hpp) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <CommentsPanel ref-type="receiving" :ref-id="id" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.table-scroll { overflow-x: auto; }
</style>
