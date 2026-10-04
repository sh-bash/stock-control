<script setup lang="ts">
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'completed', label: 'Completed' },
]

const { expeditions, loadMasters, expeditionName } = useMasters()
const list = useServerList<any>({
  endpoint: '/shipments',
  filters: [
    { key: 'status', multi: true },
    { key: 'expedition_id' },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  defaultSort: { key: 'ship_date', direction: 'desc' },
})
const { rows, totalRows, loading, errorMsg, page, pageSize, filters, setFilter, removeFilter, resetAll, activeCount } = list

const columns = [
  { key: 'no_shipment', label: 'No Shipment', sortable: true },
  { key: 'expedition_id', label: 'Ekspedisi' },
  { key: 'ship_date', label: 'Tgl Kirim', sortable: true },
  { key: 'eta_date', label: 'ETA' },
  { key: 'container_no', label: 'Container / BL' },
  { key: 'total_weight', label: 'Berat', align: 'right' as const },
  { key: 'total_volume', label: 'Volume', align: 'right' as const },
  { key: 'total_shipping_cost', label: 'Biaya Kirim', align: 'right' as const },
  { key: 'status', label: 'Status' },
]

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  for (const s of filters.status) chips.push({ key: `status:${s}`, label: `Status: ${STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}` })
  if (filters.expedition_id) chips.push({ key: 'expedition_id', label: `Ekspedisi: ${expeditionName(filters.expedition_id)}` })
  chips.push({ key: 'date_range', label: `Tgl Kirim: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
  return chips
})
function removeChip(key: string) {
  if (key.startsWith('status:')) {
    setFilter('status', filters.status.filter((s: string) => s !== key.slice(7)))
  } else if (key === 'date_range') {
    setFilter('date_from', defaultDateFrom())
    setFilter('date_to', defaultDateTo())
  } else removeFilter(key)
}

onMounted(async () => {
  await loadMasters(['expeditions'])
  await list.load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Shipments' }]" />
    <BasePageHeader title="Shipments" description="Pengiriman barang dari supplier: berat, biaya kirim, dan posisi barang." :count="totalRows">
      <template #actions>
        <NuxtLink to="/purchase/shipments/new"><BaseButton>+ Buat Shipment</BaseButton></NuxtLink>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect label="Status" :model-value="filters.status" :options="STATUS_OPTIONS" @update:model-value="(v) => setFilter('status', v)" />
      <BaseSearchableSelect label="Ekspedisi" :model-value="filters.expedition_id" :options="expeditions.map((e) => ({ value: e.id, label: e.name }))" @update:model-value="(v) => setFilter('expedition_id', v)" />
      <BaseDateRangePicker
        label="Range Tanggal Kirim"
        :from="filters.date_from"
        :to="filters.date_to"
        @update:from="(v) => setFilter('date_from', v)"
        @update:to="(v) => setFilter('date_to', v)"
      />
    </BaseFilterPanel>

    <BaseDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total-rows="totalRows"
      search-placeholder="Cari No Shipment…"
      empty-text="Belum ada Shipment"
      empty-icon="🚚"
      @search-change="list.onSearchChange"
      @sort-change="list.onSortChange"
      @update:page="list.onPageChange"
    >
      <template #empty-action><NuxtLink to="/purchase/shipments/new"><BaseButton size="sm">+ Buat Shipment</BaseButton></NuxtLink></template>
      <template #cell-no_shipment="{ row }"><NuxtLink :to="`/purchase/shipments/${row.id}`" class="link-cell">{{ row.no_shipment }}</NuxtLink></template>
      <template #cell-expedition_id="{ value }">{{ expeditionName(value) }}</template>
      <template #cell-eta_date="{ value }">{{ value || '-' }}</template>
      <template #cell-container_no="{ row }">{{ row.container_no || '-' }}<div v-if="row.bl_number" class="muted small">BL {{ row.bl_number }}</div></template>
      <template #cell-total_volume="{ value }">{{ value ? `${formatNumber(value, 3)} CBM` : '-' }}</template>
      <template #cell-total_weight="{ value }">{{ value ? `${formatQty(value)} kg` : '-' }}</template>
      <template #cell-total_shipping_cost="{ value }">Rp {{ formatNumber(Number(value)) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <NuxtLink :to="`/purchase/shipments/${row.id}`"><BaseButton variant="ghost" size="sm">Detail</BaseButton></NuxtLink>
      </template>
    </BaseDataTable>
  </div>
</template>
