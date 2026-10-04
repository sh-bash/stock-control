<script setup lang="ts">
interface Line { shipment_item_id: string; po_item_id: string; product_id: string; qty_shipped: number; qty_received: number | null }

const router = useRouter()
const notif = useNotificationStore()
const { warehouses, loadMasters, productLabel } = useMasters()

const shipments = ref<any[]>([])
const lines = ref<Line[]>([])
const saving = ref(false)
const loadingItems = ref(false)
const errorMsg = ref('')

const form = reactive({
  shipment_id: '',
  warehouse_id: '',
  receive_date: new Date().toISOString().slice(0, 10),
})

onMounted(async () => {
  await loadMasters(['warehouses', 'products'])
  shipments.value = await useApi<any[]>('/shipments')
  const preset = useRoute().query.shipment_id as string | undefined
  if (preset) await onShipmentChange(preset)
})

// Product comes from the PO item each shipment line belongs to — no manual mapping.
async function onShipmentChange(id: string) {
  form.shipment_id = id
  lines.value = []
  if (!id) return
  loadingItems.value = true
  try {
    const shp: any = await useApi(`/shipments/${id}`)
    const productOf = new Map<string, string>()
    for (const ref of shp.po_refs) {
      const po: any = await useApi(`/purchase-orders/${ref.po_id}`)
      if (!form.warehouse_id) form.warehouse_id = po.warehouse_id
      for (const it of po.items) productOf.set(it.id, it.product_id)
    }
    lines.value = shp.items.map((i: any) => ({
      shipment_item_id: i.id,
      po_item_id: i.po_item_id,
      product_id: productOf.get(i.po_item_id) ?? '',
      qty_shipped: Number(i.qty_shipped),
      qty_received: Number(i.qty_shipped),
    }))
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat shipment'
  } finally {
    loadingItems.value = false
  }
}

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const rcv: any = await useApi('/receivings', {
      method: 'POST',
      body: {
        shipment_id: form.shipment_id,
        warehouse_id: form.warehouse_id,
        receive_date: form.receive_date,
        items: lines.value
          .filter((l) => (l.qty_received ?? 0) > 0)
          .map((l) => ({ shipment_item_id: l.shipment_item_id, po_item_id: l.po_item_id, product_id: l.product_id, qty_received: l.qty_received })),
      },
    })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Receiving dibuat sebagai draft.' })
    await router.push(`/purchase/receivings/${rcv.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat receiving'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Receivings', to: '/purchase/receivings' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Receiving" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <form @submit.prevent="save">
      <section class="doc-card">
        <h2>Informasi Penerimaan</h2>
        <div class="form-grid">
          <BaseSearchableSelect
            :model-value="form.shipment_id"
            label="Shipment"
            required
            :options="shipments.map((s) => ({ value: s.id, label: `${s.no_shipment} (${s.status})` }))"
            @update:model-value="onShipmentChange"
          />
          <BaseSearchableSelect v-model="form.warehouse_id" label="Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
          <BaseDatePicker v-model="form.receive_date" label="Tanggal Terima" required />
        </div>
      </section>

      <section class="doc-card">
        <h2>Barang Diterima</h2>
        <p v-if="loadingItems" class="muted">Memuat item shipment…</p>
        <p v-else-if="!lines.length" class="muted">Pilih shipment untuk menampilkan itemnya.</p>
        <table v-else class="doc-table">
          <thead><tr><th>Produk</th><th class="num">Qty dikirim</th><th>Qty diterima</th></tr></thead>
          <tbody>
            <tr v-for="l in lines" :key="l.shipment_item_id">
              <td>{{ productLabel(l.product_id) }}</td>
              <td class="num">{{ formatQty(l.qty_shipped) }}</td>
              <td style="width: 160px"><BaseNumberInput v-model="l.qty_received" decimals="auto" /></td>
            </tr>
          </tbody>
        </table>
        <p class="muted small">Isi qty yang benar-benar diterima. Jika ada barang rusak/kurang, catat di kolom diskusi setelah receiving dibuat.</p>
      </section>

      <div class="doc-sticky-bar">
        <NuxtLink to="/purchase/receivings"><BaseButton variant="secondary">Batal</BaseButton></NuxtLink>
        <BaseButton type="submit" :loading="saving" :disabled="!lines.length">Buat Receiving</BaseButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.small { font-size: 12px; }
</style>
