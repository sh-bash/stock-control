<script setup lang="ts">
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const { warehouses, loadMasters, warehouseName } = useMasters()
const receivings = ref<any[]>([])
const receivingNo = (id: string) => receivings.value.find((r) => r.id === id)?.no_receiving || id

const list = useServerList<any>({
  endpoint: '/purchase-returns',
  filters: [
    { key: 'status', multi: true },
    { key: 'warehouse_id' },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  defaultSort: { key: 'return_date', direction: 'desc' },
})
const { rows, totalRows, loading, errorMsg, page, pageSize, filters, setFilter, removeFilter, resetAll, activeCount } = list

const columns = [
  { key: 'no_return', label: 'No Return', sortable: true },
  { key: 'receiving_id', label: 'Receiving' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'return_date', label: 'Tgl Retur', sortable: true },
  { key: 'reason', label: 'Alasan' },
  { key: 'status', label: 'Status' },
]

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  for (const s of filters.status) chips.push({ key: `status:${s}`, label: `Status: ${STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}` })
  if (filters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(filters.warehouse_id)}` })
  chips.push({ key: 'date_range', label: `Tgl Retur: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
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
  await loadMasters(['warehouses'])
  receivings.value = await useApi<any[]>('/receivings')
  await list.load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Purchase Returns' }]" />
    <BasePageHeader title="Purchase Returns" :count="totalRows">
      <template #actions>
        <NuxtLink to="/purchase/returns/new"><BaseButton>+ Buat Purchase Return</BaseButton></NuxtLink>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect label="Status" :model-value="filters.status" :options="STATUS_OPTIONS" @update:model-value="(v) => setFilter('status', v)" />
      <BaseSearchableSelect label="Warehouse" :model-value="filters.warehouse_id" :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" @update:model-value="(v) => setFilter('warehouse_id', v)" />
      <BaseDateRangePicker
        label="Range Tanggal Retur"
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
      search-placeholder="Cari No Return…"
      empty-text="Belum ada Purchase Return"
      empty-icon="↩️"
      @search-change="list.onSearchChange"
      @sort-change="list.onSortChange"
      @update:page="list.onPageChange"
    >
      <template #cell-no_return="{ row }"><NuxtLink :to="`/purchase/returns/${row.id}`" class="link-cell">{{ row.no_return }}</NuxtLink></template>
      <template #cell-receiving_id="{ value }">{{ receivingNo(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-reason="{ value }">{{ value || '-' }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <NuxtLink :to="`/purchase/returns/${row.id}`"><BaseButton variant="ghost" size="sm">Detail</BaseButton></NuxtLink>
      </template>
    </BaseDataTable>
  </div>
</template>
