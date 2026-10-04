<script setup lang="ts">
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'decided', label: 'Decided' },
  { value: 'closed', label: 'Closed' },
]

const list = useServerList<any>({
  endpoint: '/product-comparisons',
  filters: [
    { key: 'status', multi: true },
    { key: 'date_from', default: defaultDateFrom(89) },
    { key: 'date_to', default: defaultDateTo() },
  ],
  defaultSort: { key: 'created_at', direction: 'desc' },
})
const { rows, totalRows, loading, errorMsg, page, pageSize, filters, setFilter, removeFilter, resetAll, activeCount } = list

const columns = [
  { key: 'no_comparison', label: 'No Comparison', sortable: true },
  { key: 'title', label: 'Judul', sortable: true },
  { key: 'exchange_rate', label: 'Kurs RMB' },
  { key: 'status', label: 'Status' },
]

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  for (const s of filters.status) chips.push({ key: `status:${s}`, label: `Status: ${STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}` })
  chips.push({ key: 'date_range', label: `Dibuat: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
  return chips
})
function removeChip(key: string) {
  if (key.startsWith('status:')) {
    setFilter('status', filters.status.filter((s: string) => s !== key.slice(7)))
  } else if (key === 'date_range') {
    setFilter('date_from', defaultDateFrom(89))
    setFilter('date_to', defaultDateTo())
  } else removeFilter(key)
}

onMounted(() => list.load())
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Product Comparison' }]" />
    <BasePageHeader title="Product Comparison" description="Bandingkan beberapa kandidat produk/supplier untuk sebuah request, lalu pilih yang terbaik." :count="totalRows">
      <template #actions>
        <NuxtLink to="/purchase/comparisons/new"><BaseButton>+ Buat Comparison</BaseButton></NuxtLink>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect label="Status" :model-value="filters.status" :options="STATUS_OPTIONS" @update:model-value="(v) => setFilter('status', v)" />
      <BaseDateRangePicker
        label="Range Tanggal Dibuat"
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
      search-placeholder="Cari no / judul comparison…"
      empty-text="Belum ada Product Comparison"
      empty-icon="⚖️"
      @search-change="list.onSearchChange"
      @sort-change="list.onSortChange"
      @update:page="list.onPageChange"
    >
      <template #empty-action><NuxtLink to="/purchase/comparisons/new"><BaseButton size="sm">+ Buat Comparison</BaseButton></NuxtLink></template>
      <template #cell-no_comparison="{ row }"><NuxtLink :to="`/purchase/comparisons/${row.id}`" class="link-cell">{{ row.no_comparison }}</NuxtLink></template>
      <template #cell-exchange_rate="{ value }">{{ formatNumber(value) }}</template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <NuxtLink :to="`/purchase/comparisons/${row.id}`"><BaseButton variant="ghost" size="sm">Buka</BaseButton></NuxtLink>
      </template>
    </BaseDataTable>
  </div>
</template>
