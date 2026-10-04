<script setup lang="ts">
const router = useRouter()
const notif = useNotificationStore()
const { warehouses, loadMasters, productLabel, fetchProductOptions } = useMasters()

const saving = ref(false)
const errorMsg = ref('')
const form = reactive({
  warehouse_id: '',
  adjustment_date: new Date().toISOString().slice(0, 10),
  reason: '',
})
const items = ref([{ product_id: '', qty_diff: null as number | null, hpp: null as number | null }])
const addItem = () => items.value.push({ product_id: '', qty_diff: null, hpp: null })
const removeItem = (i: number) => items.value.splice(i, 1)

onMounted(() => loadMasters(['warehouses', 'products']))

async function save() {
  errorMsg.value = ''
  saving.value = true
  try {
    const a: any = await useApi('/stock-adjustments', {
      method: 'POST',
      body: {
        ...form,
        items: items.value.map((i) => ({ product_id: i.product_id, qty_diff: i.qty_diff, hpp: (i.qty_diff ?? 0) > 0 ? i.hpp : undefined })),
      },
    })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Stock Adjustment dibuat sebagai draft.' })
    await router.push(`/stock/adjustments/${a.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat adjustment'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Adjustments', to: '/stock/adjustments' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Stock Adjustment" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <form @submit.prevent="save">
      <section class="doc-card">
        <h2>Informasi</h2>
        <div class="form-grid">
          <BaseSearchableSelect v-model="form.warehouse_id" label="Warehouse" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
          <BaseDatePicker v-model="form.adjustment_date" label="Tanggal" required />
          <BaseInput v-model="form.reason" label="Alasan" placeholder="mis. stock opname" />
        </div>
      </section>

      <section class="doc-card">
        <h2>Item</h2>
        <table class="doc-table">
          <thead><tr><th style="min-width: 280px">Produk</th><th>Qty +/-</th><th>HPP (wajib jika positif)</th><th /></tr></thead>
          <tbody>
            <tr v-for="(it, i) in items" :key="i">
              <td><BaseAsyncSelect v-model="it.product_id" :model-label="productLabel(it.product_id)" :fetch-options="fetchProductOptions" placeholder="Cari produk…" /></td>
              <td style="width: 150px"><BaseNumberInput v-model="it.qty_diff" decimals="auto" allow-negative required /></td>
              <td style="width: 170px"><BaseNumberInput v-model="it.hpp" :disabled="(it.qty_diff ?? 0) <= 0" /></td>
              <td><BaseButton variant="ghost" size="sm" :disabled="items.length === 1" @click="removeItem(i)">Hapus</BaseButton></td>
            </tr>
          </tbody>
        </table>
        <BaseButton variant="secondary" size="sm" @click="addItem">+ Tambah Item</BaseButton>
      </section>

      <div class="doc-sticky-bar">
        <NuxtLink to="/stock/adjustments"><BaseButton variant="secondary">Batal</BaseButton></NuxtLink>
        <BaseButton type="submit" :loading="saving">Simpan Draft</BaseButton>
      </div>
    </form>
  </div>
</template>
