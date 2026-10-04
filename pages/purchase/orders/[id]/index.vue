<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const swal = useSwal()
const notif = useNotificationStore()
const { loadMasters, supplierName, warehouseName, productLabel } = useMasters()

const po = ref<any>(null)
const loading = ref(true)
const errorMsg = ref('')

async function load() {
  try {
    po.value = await useApi(`/purchase-orders/${id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat PO'
  } finally {
    loading.value = false
  }
}

const editable = computed(() => ['draft', 'rejected'].includes(po.value?.status))
const isRmb = computed(() => po.value?.currency === 'RMB')

async function act(action: 'submit' | 'approve' | 'reject') {
  const p = po.value
  const confirmed =
    action === 'approve'
      ? await swal.confirmApprove(`PO <strong>${p.no_po}</strong> akan disetujui dan lanjut ke tahap pengiriman.`)
      : action === 'reject'
        ? await swal.confirmReject(`PO <strong>${p.no_po}</strong> akan ditolak.`)
        : await swal.confirmAction({ title: 'Submit PO?', message: `PO <strong>${p.no_po}</strong> akan dikirim untuk persetujuan.`, confirmText: 'Ya, Submit' })
  if (!confirmed) return
  try {
    await useApi(`/purchase-orders/${id}/${action}`, { method: 'POST' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `PO ${p.no_po}: ${action} berhasil.` })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Aksi gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

async function remove() {
  if (!(await swal.confirmDelete(po.value.no_po))) return
  try {
    await useApi(`/purchase-orders/${id}`, { method: 'DELETE' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'PO dihapus.' })
    await router.push('/purchase/orders')
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal menghapus', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

onMounted(async () => {
  await loadMasters(['suppliers', 'warehouses', 'products'])
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Purchase Order', to: '/purchase/orders' }, { label: po?.no_po ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="po">
      <BasePageHeader :title="po.no_po" :description="supplierName(po.supplier_id)">
        <template #actions>
          <div class="doc-actions">
            <BaseBadge :status="po.status" />
            <template v-if="editable">
              <NuxtLink :to="`/purchase/orders/${id}/edit`"><BaseButton variant="secondary" size="sm">Ubah</BaseButton></NuxtLink>
              <BaseButton size="sm" @click="act('submit')">Submit</BaseButton>
              <BaseButton v-if="po.status === 'draft'" variant="danger" size="sm" @click="remove">Hapus</BaseButton>
            </template>
            <template v-if="po.status === 'waiting_approval'">
              <BaseButton size="sm" @click="act('approve')">Approve</BaseButton>
              <BaseButton variant="danger" size="sm" @click="act('reject')">Reject</BaseButton>
            </template>
            <NuxtLink v-if="['approved', 'partial_received'].includes(po.status)" to="/purchase/shipments/new">
              <BaseButton size="sm">Buat Shipment</BaseButton>
            </NuxtLink>
          </div>
        </template>
      </BasePageHeader>

      <div class="doc-layout">
        <div>
          <section class="doc-card">
            <dl class="doc-meta">
              <div><dt>Supplier</dt><dd>{{ supplierName(po.supplier_id) }}</dd></div>
              <div><dt>Warehouse</dt><dd>{{ warehouseName(po.warehouse_id) }}</dd></div>
              <div><dt>Tanggal Order</dt><dd>{{ po.order_date }}</dd></div>
              <div><dt>Mata Uang</dt><dd>{{ po.currency }}<template v-if="isRmb"> · kurs {{ formatNumber(po.exchange_rate) }}</template></dd></div>
              <div v-if="po.request_id"><dt>Product Request</dt><dd><NuxtLink :to="`/purchase/requests/${po.request_id}`" class="link-cell">Lihat request</NuxtLink></dd></div>
              <div v-if="po.comparison_id"><dt>Comparison</dt><dd><NuxtLink :to="`/purchase/comparisons/${po.comparison_id}`" class="link-cell">Lihat comparison</NuxtLink></dd></div>
            </dl>
            <p v-if="po.notes" class="notes">{{ po.notes }}</p>
          </section>

          <section class="doc-card">
            <h2>Item</h2>
            <div class="table-scroll">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th class="num">Qty</th>
                    <th v-if="isRmb" class="num">Harga (¥)</th>
                    <th class="num">Harga (Rp)</th>
                    <th class="num">Subtotal (Rp)</th>
                    <th class="num">Diterima</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="i in po.items" :key="i.id">
                    <td>{{ productLabel(i.product_id) }}</td>
                    <td class="num">{{ formatQty(i.qty_order) }}</td>
                    <td v-if="isRmb" class="num">{{ formatNumber(i.price_foreign) }}</td>
                    <td class="num">{{ formatNumber(i.unit_price) }}</td>
                    <td class="num">{{ formatNumber(Number(i.qty_order) * Number(i.unit_price)) }}</td>
                    <td class="num">{{ formatQty(i.qty_received) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr v-if="isRmb"><td :colspan="4" class="num">Total (¥)</td><td class="num">¥ {{ formatNumber(po.total_foreign) }}</td><td /></tr>
                  <tr><td :colspan="isRmb ? 4 : 3" class="num">Total (Rp)</td><td class="num">Rp {{ formatNumber(po.total_idr) }}</td><td /></tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        <CommentsPanel ref-type="po" :ref-id="id" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.notes { margin: 12px 0 0; font-size: 13px; white-space: pre-wrap; }
.table-scroll { overflow-x: auto; }
</style>
