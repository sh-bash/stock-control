<script setup lang="ts">
const router = useRouter()
const notif = useNotificationStore()
const { loadMasters, productLabel } = useMasters()

const receivings = ref<any[]>([])
const lines = ref<{ product_id: string; stock_layer_id: string; qty_received: number; qty_remaining: number | null; qty_return: number | null }[]>([])
const saving = ref(false)
const errorMsg = ref('')

const form = reactive({
  receiving_id: '',
  warehouse_id: '',
  return_date: new Date().toISOString().slice(0, 10),
  reason: '',
})

async function onReceivingChange(id: string) {
  form.receiving_id = id
  lines.value = []
  if (!id) return
  const rcv: any = await useApi(`/receivings/${id}`)
  form.warehouse_id = rcv.warehouse_id
  // Show how much of each received layer is still in stock so the user
  // can't over-return.
  const layers = await useApi<any[]>('/stock/layers', { query: { warehouse_id: rcv.warehouse_id } }).catch(() => [])
  const remaining = new Map<string, number>((layers ?? []).map((l: any) => [l.id, Number(l.qty_remaining)]))
  lines.value = rcv.items
    .filter((i: any) => i.stock_layer_id)
    .map((i: any) => ({
      product_id: i.product_id,
      stock_layer_id: i.stock_layer_id,
      qty_received: Number(i.qty_received),
      qty_remaining: remaining.get(i.stock_layer_id) ?? null,
      qty_return: null,
    }))
}

onMounted(async () => {
  await loadMasters(['products'])
  receivings.value = (await useApi<any[]>('/receivings')).filter((r) => r.status === 'approved')
  const preset = useRoute().query.receiving_id as string | undefined
  if (preset) await onReceivingChange(preset)
})

async function save() {
  errorMsg.value = ''
  const items = lines.value.filter((l) => (l.qty_return ?? 0) > 0)
  if (!items.length) {
    errorMsg.value = 'Isi qty retur untuk minimal 1 item'
    return
  }
  saving.value = true
  try {
    const ret: any = await useApi('/purchase-returns', {
      method: 'POST',
      body: {
        receiving_id: form.receiving_id,
        warehouse_id: form.warehouse_id,
        return_date: form.return_date,
        reason: form.reason || undefined,
        items: items.map((l) => ({ product_id: l.product_id, stock_layer_id: l.stock_layer_id, qty_return: l.qty_return })),
      },
    })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Purchase Return dibuat sebagai draft.' })
    await router.push(`/purchase/returns/${ret.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat purchase return'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Purchase Returns', to: '/purchase/returns' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Purchase Return" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <ReturnWarnings v-if="form.receiving_id" :receiving-id="form.receiving_id" />

    <form @submit.prevent="save">
      <section class="doc-card">
        <h2>Informasi Retur</h2>
        <div class="form-grid">
          <BaseSearchableSelect
            :model-value="form.receiving_id"
            label="Receiving (approved)"
            required
            :options="receivings.map((r) => ({ value: r.id, label: r.no_receiving }))"
            @update:model-value="onReceivingChange"
          />
          <BaseDatePicker v-model="form.return_date" label="Tanggal Retur" required />
          <BaseInput v-model="form.reason" label="Alasan" />
        </div>
      </section>

      <section class="doc-card">
        <h2>Barang yang diretur</h2>
        <p v-if="!lines.length" class="muted">Pilih receiving untuk menampilkan itemnya.</p>
        <table v-else class="doc-table">
          <thead><tr><th>Produk</th><th class="num">Diterima</th><th class="num">Sisa di stok</th><th>Qty retur</th></tr></thead>
          <tbody>
            <tr v-for="l in lines" :key="l.stock_layer_id">
              <td>{{ productLabel(l.product_id) }}</td>
              <td class="num">{{ formatQty(l.qty_received) }}</td>
              <td class="num">{{ l.qty_remaining == null ? '-' : formatQty(l.qty_remaining) }}</td>
              <td style="width: 160px"><BaseNumberInput v-model="l.qty_return" decimals="auto" /></td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="doc-sticky-bar">
        <NuxtLink to="/purchase/returns"><BaseButton variant="secondary">Batal</BaseButton></NuxtLink>
        <BaseButton type="submit" :loading="saving" :disabled="!lines.length">Buat Purchase Return</BaseButton>
      </div>
    </form>
  </div>
</template>
