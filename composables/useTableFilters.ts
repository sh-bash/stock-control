// Shared filter-state helper for list pages: keeps a reactive `filters`
// object in sync with the URL query string (so filtered views are
// refreshable/shareable), and exposes a small chip/reset API for
// BaseFilterPanel. Deliberately dumb about *labels* — resolving an id like
// warehouse_id into a human-readable chip label is the page's job (it has
// the master list loaded), this composable only tracks raw filter values.
export interface FilterDef {
  key: string
  multi?: boolean
  default?: string
}

export function useTableFilters(defs: FilterDef[], onChange: () => void) {
  const route = useRoute()
  const router = useRouter()

  const filters = reactive<Record<string, any>>({})
  for (const d of defs) {
    const raw = route.query[d.key]
    const str = Array.isArray(raw) ? raw[0] : raw
    if (d.multi) {
      filters[d.key] = typeof str === 'string' && str.length > 0 ? str.split(',') : []
    } else {
      filters[d.key] = typeof str === 'string' && str.length > 0 ? str : (d.default ?? '')
    }
  }

  function syncUrl() {
    const query: Record<string, any> = { ...route.query }
    for (const d of defs) {
      const val = filters[d.key]
      const isEmpty = d.multi ? !val || val.length === 0 : !val
      if (isEmpty) delete query[d.key]
      else query[d.key] = d.multi ? val.join(',') : val
    }
    router.replace({ query })
  }

  function setFilter(key: string, value: any) {
    filters[key] = value
    syncUrl()
    onChange()
  }

  function removeFilter(key: string) {
    const def = defs.find((d) => d.key === key)
    filters[key] = def?.multi ? [] : (def?.default ?? '')
    syncUrl()
    onChange()
  }

  function resetAll() {
    for (const d of defs) filters[d.key] = d.multi ? [] : (d.default ?? '')
    syncUrl()
    onChange()
  }

  const activeCount = computed(
    () => defs.filter((d) => (d.multi ? filters[d.key]?.length > 0 : !!filters[d.key])).length,
  )

  return { filters, setFilter, removeFilter, resetAll, activeCount }
}
