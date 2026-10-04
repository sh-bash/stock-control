<script setup lang="ts">
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]

const { warehouses, loadMasters, warehouseName } = useMasters()
const list = useServerList<any>({
  endpoint: '/stock-transfers',
  filters: [
    { key: 'status', multi: true },
    { key: 'from_warehouse_id' },
    { key: 'to_warehouse_id' },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  defaultSort: { key: 'transfer_date', direction: 'desc' },
})
const { rows, totalRows, loading, errorMsg, page, pageSize, filters, setFilter, removeFilter, resetAll, activeCount } = list

const columns = [
  { key: 'no_transfer', label: 'No Transfer', sortable: true },
  { key: 'from_warehouse_id', label: 'Dari' },
  { key: 'to_warehouse_id', label: 'Ke' },
  { key: 'transfer_date', label: 'Tanggal', sortable: true },
  { key: 'status', label: 'Status' },
]

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  for (const s of filters.status) chips.push({ key: `status:${s}`, label: `Status: ${STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}` })
  if (filters.from_warehouse_id) chips.push({ key: 'from_warehouse_id', label: `Dari: ${warehouseName(filters.from_warehouse_id)}` })
  if (filters.to_warehouse_id) chips.push({ key: 'to_warehouse_id', label: `Ke: ${warehouseName(filters.to_warehouse_id)}` })
  chips.push({ key: 'date_range', label: `Tanggal: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
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
  await list.load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Transfers' }]" />
    <BasePageHeader title="Stock Transfers" :count="totalRows">
      <template #actions>
        <NuxtLink to="/stock/transfers/new"><BaseButton>+ Buat Transfer</BaseButton></NuxtLink>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect label="Status" :model-value="filters.status" :options="STATUS_OPTIONS" @update:model-value="(v) => setFilter('status', v)" />
      <BaseSearchableSelect label="Dari Warehouse" :model-value="filters.from_warehouse_id" :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" @update:model-value="(v) => setFilter('from_warehouse_id', v)" />
      <BaseSearchableSelect label="Ke Warehouse" :model-value="filters.to_warehouse_id" :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" @update:model-value="(v) => setFilter('to_warehouse_id', v)" />
      <BaseDateRangePicker
        label="Range Tanggal"
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
      search-placeholder="Cari No Transfer…"
      empty-text="Belum ada Stock Transfer"
      empty-icon="🔁"
      @search-change="list.onSearchChange"
      @sort-change="list.onSortChange"
      @update:page="list.onPageChange"
    >
      <template #cell-no_transfer="{ row }"><NuxtLink :to="`/stock/transfers/${row.id}`" class="link-cell">{{ row.no_transfer }}</NuxtLink></template>
      <template #cell-from_warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-to_warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <NuxtLink :to="`/stock/transfers/${row.id}`"><BaseButton variant="ghost" size="sm">Detail</BaseButton></NuxtLink>
      </template>
    </BaseDataTable>
  </div>
</template>
