<script setup lang="ts">
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'comparing', label: 'Comparing' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'closed', label: 'Closed' },
]

const { loadMasters, userName } = useMasters()
const list = useServerList<any>({
  endpoint: '/product-requests',
  filters: [
    { key: 'status', multi: true },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  defaultSort: { key: 'created_at', direction: 'desc' },
})
const { rows, totalRows, loading, errorMsg, page, pageSize, filters, setFilter, removeFilter, resetAll, activeCount } = list

const columns = [
  { key: 'no_request', label: 'No Request', sortable: true },
  { key: 'title', label: 'Judul', sortable: true },
  { key: 'requested_by', label: 'Peminta' },
  { key: 'needed_date', label: 'Dibutuhkan', sortable: true },
  { key: 'needs_approval', label: 'Approval' },
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
    setFilter('date_from', defaultDateFrom())
    setFilter('date_to', defaultDateTo())
  } else removeFilter(key)
}

onMounted(async () => {
  await loadMasters(['users'])
  await list.load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Product Request' }]" />
    <BasePageHeader title="Product Request" description="Pengajuan produk baru. Setelah disetujui, bisa dibandingkan (Comparison) lalu dibuatkan PO." :count="totalRows">
      <template #actions>
        <NuxtLink to="/purchase/requests/new"><BaseButton>+ Buat Request</BaseButton></NuxtLink>
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
      search-placeholder="Cari no / judul request…"
      empty-text="Belum ada Product Request"
      empty-icon="📝"
      @search-change="list.onSearchChange"
      @sort-change="list.onSortChange"
      @update:page="list.onPageChange"
    >
      <template #empty-action><NuxtLink to="/purchase/requests/new"><BaseButton size="sm">+ Buat Request</BaseButton></NuxtLink></template>
      <template #cell-no_request="{ row }"><NuxtLink :to="`/purchase/requests/${row.id}`" class="link-cell">{{ row.no_request }}</NuxtLink></template>
      <template #cell-requested_by="{ value }">{{ userName(value) }}</template>
      <template #cell-needs_approval="{ value }"><BaseBadge :status="value ? 'warning' : 'neutral'">{{ value ? 'Perlu approval' : 'Tanpa approval' }}</BaseBadge></template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <NuxtLink :to="`/purchase/requests/${row.id}`"><BaseButton variant="ghost" size="sm">Detail</BaseButton></NuxtLink>
      </template>
    </BaseDataTable>
  </div>
</template>
