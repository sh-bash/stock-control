// Shared state for server-paginated transaction lists (the pattern every list
// page used to repeat by hand): paging, search, sort, URL-synced filters.
// Every filter value is sent as a query param; multi filters are comma-joined.
interface ListOptions {
  endpoint: string
  filters: FilterDef[]
  defaultSort?: { key: string; direction: 'asc' | 'desc' }
  pageSize?: number
}

export function useServerList<T = any>(opts: ListOptions) {
  const rows = ref<T[]>([]) as Ref<T[]>
  const totalRows = ref(0)
  const loading = ref(false)
  const errorMsg = ref('')
  const page = ref(1)
  const pageSize = opts.pageSize ?? 20
  const search = ref('')
  const sort = ref<{ key: string; direction: 'asc' | 'desc' | null }>(
    opts.defaultSort ?? { key: '', direction: null },
  )

  async function load() {
    loading.value = true
    errorMsg.value = ''
    try {
      const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
      if (search.value) params.set('search', search.value)
      for (const def of opts.filters) {
        const v = filterState.filters[def.key]
        if (def.multi ? v?.length : v) params.set(def.key, def.multi ? v.join(',') : v)
      }
      if (sort.value.direction) {
        params.set('sortBy', sort.value.key)
        params.set('sortDir', sort.value.direction)
      }
      const res = await useApiEnvelope<T[]>(`${opts.endpoint}?${params.toString()}`)
      rows.value = res.data
      totalRows.value = Number(res.meta?.totalRows ?? res.data.length)
    } catch (err: any) {
      errorMsg.value = err?.data?.data?.message || 'Gagal memuat data'
    } finally {
      loading.value = false
    }
  }

  const filterState = useTableFilters(opts.filters, () => {
    page.value = 1
    load()
  })

  function onSearchChange(v: string) {
    search.value = v
    page.value = 1
    load()
  }
  function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
    sort.value = s
    load()
  }
  function onPageChange(p: number) {
    page.value = p
    load()
  }

  return {
    rows,
    totalRows,
    loading,
    errorMsg,
    page,
    pageSize,
    ...filterState,
    load,
    onSearchChange,
    onSortChange,
    onPageChange,
  }
}
