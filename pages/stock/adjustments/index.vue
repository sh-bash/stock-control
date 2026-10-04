<script setup lang="ts">
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const { warehouses, loadMasters, warehouseName } = useMasters()
const list = useServerList<any>({
  endpoint: '/stock-adjustments',
  filters: [
    { key: 'status', multi: true },
    { key: 'warehouse_id' },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  defaultSort: { key: 'adjustment_date', direction: 'desc' },
})
const { rows, totalRows, loading, errorMsg, page, pageSize, filters, setFilter, removeFilter, resetAll, activeCount } = list

const columns = [
  { key: 'no_adjustment', label: 'No Adjustment', sortable: true },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'adjustment_date', label: 'Tanggal', sortable: true },
  { key: 'reason', label: 'Alasan' },
  { key: 'status', label: 'Status' },
]

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  for (const s of filters.status) chips.push({ key: `status:${s}`, label: `Status: ${STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}` })
  if (filters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(filters.warehouse_id)}` })
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
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Stock Adjustments' }]" />
    <BasePageHeader title="Stock Adjustments" description="Koreksi manual stok (opname, rusak, hilang). Untuk memuat stok awal dari file, gunakan Import Stock." :count="totalRows">
      <template #actions>
        <NuxtLink to="/stock/import"><BaseButton variant="secondary">⬆ Import Stock</BaseButton></NuxtLink>
        <NuxtLink to="/stock/adjustments/new"><BaseButton>+ Buat Adjustment</BaseButton></NuxtLink>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect label="Status" :model-value="filters.status" :options="STATUS_OPTIONS" @update:model-value="(v) => setFilter('status', v)" />
      <BaseSearchableSelect label="Warehouse" :model-value="filters.warehouse_id" :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" @update:model-value="(v) => setFilter('warehouse_id', v)" />
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
      search-placeholder="Cari No Adjustment…"
      empty-text="Belum ada Stock Adjustment"
      empty-icon="🛠️"
      @search-change="list.onSearchChange"
      @sort-change="list.onSortChange"
      @update:page="list.onPageChange"
    >
      <template #cell-no_adjustment="{ row }"><NuxtLink :to="`/stock/adjustments/${row.id}`" class="link-cell">{{ row.no_adjustment }}</NuxtLink></template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-reason="{ value }">{{ value || '-' }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <NuxtLink :to="`/stock/adjustments/${row.id}`"><BaseButton variant="ghost" size="sm">Detail</BaseButton></NuxtLink>
      </template>
    </BaseDataTable>
  </div>
</template>
