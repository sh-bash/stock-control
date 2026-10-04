<script setup lang="ts">
const id = useRoute().params.id as string
const { loadMasters, warehouseName, productLabel } = useMasters()

const t = ref<any>(null)
const loading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  await loadMasters(['warehouses', 'products'])
  try {
    t.value = await useApi(`/stock-transfers/${id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat transfer'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Transfers', to: '/stock/transfers' }, { label: t?.no_transfer ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="t">
      <BasePageHeader :title="t.no_transfer">
        <template #actions><BaseBadge :status="t.status" /></template>
      </BasePageHeader>
      <section class="doc-card">
        <dl class="doc-meta">
          <div><dt>Dari</dt><dd>{{ warehouseName(t.from_warehouse_id) }}</dd></div>
          <div><dt>Ke</dt><dd>{{ warehouseName(t.to_warehouse_id) }}</dd></div>
          <div><dt>Tanggal</dt><dd>{{ t.transfer_date }}</dd></div>
        </dl>
      </section>
      <section class="doc-card">
        <h2>Item</h2>
        <table class="doc-table">
          <thead><tr><th>Produk</th><th class="num">Qty</th></tr></thead>
          <tbody>
            <tr v-for="i in t.items" :key="i.id"><td>{{ productLabel(i.product_id) }}</td><td class="num">{{ formatQty(i.qty) }}</td></tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
