<script setup lang="ts">
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'partial_received', label: 'Partial Received' },
  { value: 'closed', label: 'Closed' },
]

const { suppliers, warehouses, loadMasters, supplierName, warehouseName } = useMasters()
const list = useServerList<any>({
  endpoint: '/purchase-orders',
  filters: [
    { key: 'status', multi: true },
    { key: 'supplier_id' },
    { key: 'warehouse_id' },
    { key: 'date_from', default: defaultDateFrom() },
    { key: 'date_to', default: defaultDateTo() },
  ],
  defaultSort: { key: 'order_date', direction: 'desc' },
})
const { rows, totalRows, loading, errorMsg, page, pageSize, filters, setFilter, removeFilter, resetAll, activeCount } = list

const columns = [
  { key: 'no_po', label: 'No PO', sortable: true },
  { key: 'supplier_id', label: 'Supplier' },
  { key: 'warehouse_id', label: 'Warehouse' },
  { key: 'currency', label: 'Mata Uang' },
  { key: 'order_date', label: 'Order Date', sortable: true },
  { key: 'status', label: 'Status' },
]

const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  for (const s of filters.status) chips.push({ key: `status:${s}`, label: `Status: ${STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}` })
  if (filters.supplier_id) chips.push({ key: 'supplier_id', label: `Supplier: ${supplierName(filters.supplier_id)}` })
  if (filters.warehouse_id) chips.push({ key: 'warehouse_id', label: `Warehouse: ${warehouseName(filters.warehouse_id)}` })
  chips.push({ key: 'date_range', label: `Order Date: ${formatDateRangeLabel(filters.date_from, filters.date_to)}` })
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
  await loadMasters(['suppliers', 'warehouses'])
  await list.load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Purchase Order' }]" />
    <BasePageHeader title="Purchase Order" :count="totalRows">
      <template #actions>
        <NuxtLink to="/purchase/orders/new"><BaseButton>+ Buat PO Baru</BaseButton></NuxtLink>
      </template>
    </BasePageHeader>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <BaseFilterPanel :chips="filterChips" :active-count="activeCount" @remove-chip="removeChip" @reset="resetAll">
      <BaseMultiSelect label="Status" :model-value="filters.status" :options="STATUS_OPTIONS" @update:model-value="(v) => setFilter('status', v)" />
      <BaseSearchableSelect label="Supplier" :model-value="filters.supplier_id" :options="suppliers.map((s) => ({ value: s.id, label: s.name }))" @update:model-value="(v) => setFilter('supplier_id', v)" />
      <BaseSearchableSelect label="Warehouse" :model-value="filters.warehouse_id" :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" @update:model-value="(v) => setFilter('warehouse_id', v)" />
      <BaseDateRangePicker
        label="Range Tanggal Order"
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
      search-placeholder="Cari No PO…"
      empty-text="Belum ada Purchase Order"
      empty-icon="🧾"
      @search-change="list.onSearchChange"
      @sort-change="list.onSortChange"
      @update:page="list.onPageChange"
    >
      <template #empty-action><NuxtLink to="/purchase/orders/new"><BaseButton size="sm">+ Buat PO Baru</BaseButton></NuxtLink></template>
      <template #cell-no_po="{ row }"><NuxtLink :to="`/purchase/orders/${row.id}`" class="link-cell">{{ row.no_po }}</NuxtLink></template>
      <template #cell-supplier_id="{ value }">{{ supplierName(value) }}</template>
      <template #cell-warehouse_id="{ value }">{{ warehouseName(value) }}</template>
      <template #cell-currency="{ row }">{{ row.currency }}<span v-if="row.currency === 'RMB'" class="muted"> @ {{ formatNumber(row.exchange_rate) }}</span></template>
      <template #cell-status="{ value }"><BaseBadge :status="value" /></template>
      <template #actions="{ row }">
        <NuxtLink :to="`/purchase/orders/${row.id}`"><BaseButton variant="ghost" size="sm">Detail</BaseButton></NuxtLink>
      </template>
    </BaseDataTable>
  </div>
</template>
