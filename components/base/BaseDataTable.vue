<script setup lang="ts">
// Server-side table: this component never fetches or filters data itself —
// it only renders what it's given and emits page/sort/search/filter change
// events so the parent page can re-fetch from the API. That keeps it usable
// for both small master-data lists and huge tables like stock_ledger, where
// loading "all rows" client-side isn't an option.

export interface BaseTableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
  filterOptions?: readonly { value: string; label: string }[]
}

const props = withDefaults(
  defineProps<{
    columns: readonly BaseTableColumn[]
    data: readonly any[]
    loading?: boolean
    rowKey?: string
    page?: number
    pageSize?: number
    totalRows?: number
    searchable?: boolean
    searchPlaceholder?: string
    searchDebounceMs?: number
    emptyText?: string
  }>(),
  {
    loading: false,
    rowKey: 'id',
    page: 1,
    pageSize: 20,
    totalRows: 0,
    searchable: true,
    searchPlaceholder: 'Cari...',
    searchDebounceMs: 400,
    emptyText: 'Tidak ada data',
  },
)

const emit = defineEmits<{
  'update:page': [number]
  'sort-change': [{ key: string; direction: 'asc' | 'desc' | null }]
  'search-change': [string]
  'filter-change': [{ key: string; value: string }]
}>()

const searchText = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchText, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => emit('search-change', val), props.searchDebounceMs)
})

const sortState = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })
function onSortClick(col: BaseTableColumn) {
  if (!col.sortable) return
  if (sortState.value.key !== col.key) {
    sortState.value = { key: col.key, direction: 'asc' }
  } else if (sortState.value.direction === 'asc') {
    sortState.value = { key: col.key, direction: 'desc' }
  } else if (sortState.value.direction === 'desc') {
    sortState.value = { key: '', direction: null }
  } else {
    sortState.value = { key: col.key, direction: 'asc' }
  }
  emit('sort-change', sortState.value)
}

const filterColumns = computed(() => props.columns.filter((c) => c.filterOptions && c.filterOptions.length > 0))
const filterValues = ref<Record<string, string>>({})
function onFilterChange(key: string, value: string) {
  filterValues.value[key] = value
  emit('filter-change', { key, value })
}

const showPagination = computed(() => props.totalRows > 0 && props.pageSize > 0)
const skeletonRows = computed(() => Math.min(props.pageSize || 5, 8))
</script>

<template>
  <div class="base-table-wrapper">
    <div v-if="searchable || $slots['toolbar-actions'] || filterColumns.length > 0" class="table-toolbar">
      <input v-if="searchable" v-model="searchText" class="table-search" type="text" :placeholder="searchPlaceholder" />
      <select
        v-for="col in filterColumns"
        :key="col.key"
        class="table-filter"
        :value="filterValues[col.key] ?? ''"
        @change="onFilterChange(col.key, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ col.label }}: Semua</option>
        <option v-for="opt in col.filterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <div class="toolbar-spacer" />
      <slot name="toolbar-actions" />
    </div>

    <div class="table-scroll">
      <table class="base-table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="[col.align ? `align-${col.align}` : '', { sortable: col.sortable }]"
              :style="col.width ? { width: col.width } : {}"
              @click="onSortClick(col)"
            >
              <span class="th-content">
                {{ col.label }}
                <span v-if="col.sortable" class="sort-arrow" :class="{ active: sortState.key === col.key }">
                  {{ sortState.key === col.key ? (sortState.direction === 'asc' ? '▲' : sortState.direction === 'desc' ? '▼' : '↕' ) : '↕' }}
                </span>
              </span>
            </th>
            <th v-if="$slots.actions" class="align-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in skeletonRows" :key="`sk-${i}`" class="skeleton-row">
              <td v-for="col in columns" :key="col.key"><span class="skeleton-bar" /></td>
              <td v-if="$slots.actions"><span class="skeleton-bar" /></td>
            </tr>
          </template>
          <template v-else-if="data.length > 0">
            <tr v-for="row in data" :key="row[rowKey]">
              <td v-for="col in columns" :key="col.key" :class="col.align ? `align-${col.align}` : ''">
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">{{ row[col.key] }}</slot>
              </td>
              <td v-if="$slots.actions" class="align-right row-actions">
                <slot name="actions" :row="row" />
              </td>
            </tr>
          </template>
          <tr v-else class="empty-row">
            <td :colspan="columns.length + ($slots.actions ? 1 : 0)">
              <slot name="empty">
                <div class="empty-state">{{ emptyText }}</div>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BasePagination v-if="showPagination" :page="page" :page-size="pageSize" :total-rows="totalRows" @update:page="(p) => $emit('update:page', p)" />
  </div>
</template>

<style scoped>
.base-table-wrapper {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-1);
  overflow: hidden;
}
.table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-neutral-bg);
}
.table-search {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  min-width: 220px;
  flex-shrink: 0;
}
.table-filter {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.toolbar-spacer {
  flex: 1;
}
.table-scroll {
  overflow-x: auto;
}
.base-table {
  width: 100%;
  border-collapse: collapse;
}
.base-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-neutral-bg);
  white-space: nowrap;
}
.base-table th.sortable {
  cursor: pointer;
  user-select: none;
}
.th-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sort-arrow {
  font-size: 10px;
  opacity: 0.4;
}
.sort-arrow.active {
  opacity: 1;
  color: var(--color-info);
}
.base-table td {
  padding: 10px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--color-neutral-bg);
  color: var(--color-text);
}
.align-left {
  text-align: left;
}
.align-right {
  text-align: right;
}
.align-center {
  text-align: center;
}
.row-actions {
  display: table-cell;
  white-space: nowrap;
}
.empty-row td {
  border-bottom: none;
}
.empty-state {
  padding: 40px 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
.skeleton-bar {
  display: block;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--color-neutral-bg) 25%, #f1f5f9 37%, var(--color-neutral-bg) 63%);
  background-size: 400% 100%;
  animation: base-table-shimmer 1.4s ease infinite;
}
@keyframes base-table-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
