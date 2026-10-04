<script setup lang="ts">
interface Layer { id: string; product_id: string; warehouse_id: string; qty_remaining: string; hpp: string; receive_date: string; status: string }

const router = useRouter()
const notif = useNotificationStore()
const { warehouses, loadMasters, productLabel } = useMasters()

const layers = ref<Layer[]>([])
const saving = ref(false)
const errorMsg = ref('')
const form = reactive({
  from_warehouse_id: '',
  to_warehouse_id: '',
  transfer_date: new Date().toISOString().slice(0, 10),
})
const items = ref([{ product_id: '', stock_layer_id: '', qty: null as number | null }])

onMounted(async () => {
  await loadMasters(['warehouses', 'products'])
  layers.value = (await useApi<Layer[]>('/stock/layers')).filter((l) => l.status === 'active' && Number(l.qty_remaining) > 0)
})

const layerOptions = computed(() =>
  layers.value
    .filter((l) => l.warehouse_id === form.from_warehouse_id)
    .map((l) => ({ value: l.id, label: `${productLabel(l.product_id)} — sisa ${formatQty(l.qty_remaining)}, HPP ${formatNumber(l.hpp)}, masuk ${l.receive_date}` })),
)
const remainingOf = (layerId: string) => Number(layers.value.find((l) => l.id === layerId)?.qty_remaining ?? 0)

const addItem = () => items.value.push({ product_id: '', stock_layer_id: '', qty: null })
const removeItem = (i: number) => items.value.splice(i, 1)
function onLayer(i: number, id: string) {
  items.value[i].stock_layer_id = id
  const l = layers.value.find((x) => x.id === id)
  if (l) items.value[i].product_id = l.product_id
}
watch(() => form.from_warehouse_id, () => { items.value = [{ product_id: '', stock_layer_id: '', qty: null }] })

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const t: any = await useApi('/stock-transfers', { method: 'POST', body: { ...form, items: items.value } })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Transfer dieksekusi.' })
    await router.push(`/stock/transfers/${t.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat transfer'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Transfers', to: '/stock/transfers' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Stock Transfer" description="Transfer langsung dieksekusi saat disimpan." />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <form @submit.prevent="save">
      <section class="doc-card">
        <h2>Informasi</h2>
        <div class="form-grid">
          <BaseSearchableSelect v-model="form.from_warehouse_id" label="Dari Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
          <BaseSearchableSelect v-model="form.to_warehouse_id" label="Ke Warehouse" required :options="warehouses.filter((w) => w.id !== form.from_warehouse_id).map((w) => ({ value: w.id, label: w.name }))" />
          <BaseDatePicker v-model="form.transfer_date" label="Tanggal Transfer" required />
        </div>
      </section>

      <section class="doc-card">
        <h2>Layer stok yang dipindah</h2>
        <p v-if="!form.from_warehouse_id" class="muted">Pilih gudang asal terlebih dahulu.</p>
        <table v-else class="doc-table">
          <thead><tr><th>Layer (produk · sisa · HPP · tanggal masuk)</th><th>Qty</th><th /></tr></thead>
          <tbody>
            <tr v-for="(it, i) in items" :key="i">
              <td><BaseSearchableSelect :model-value="it.stock_layer_id" :options="layerOptions" required @update:model-value="(v) => onLayer(i, v)" /></td>
              <td style="width: 170px">
                <BaseNumberInput v-model="it.qty" decimals="auto" required :max="remainingOf(it.stock_layer_id) || undefined" />
              </td>
              <td><BaseButton variant="ghost" size="sm" :disabled="items.length === 1" @click="removeItem(i)">Hapus</BaseButton></td>
            </tr>
          </tbody>
        </table>
        <BaseButton v-if="form.from_warehouse_id" variant="secondary" size="sm" @click="addItem">+ Tambah Item</BaseButton>
      </section>

      <div class="doc-sticky-bar">
        <NuxtLink to="/stock/transfers"><BaseButton variant="secondary">Batal</BaseButton></NuxtLink>
        <BaseButton type="submit" :loading="saving">Buat &amp; Eksekusi Transfer</BaseButton>
      </div>
    </form>
  </div>
</template>
