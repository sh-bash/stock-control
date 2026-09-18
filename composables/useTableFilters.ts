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

// Shared "last 30 days" default for the mandatory date-range filter on every
// transaction list — computed fresh each call (not a module-level constant)
// so a page kept open across midnight still gets today, not a stale date.
export function defaultDateFrom(daysBack = 29) {
  return new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
export function defaultDateTo() {
  return new Date().toISOString().slice(0, 10)
}

const SHORT_MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// Renders the active date range for the filter chip, e.g. "19 Agu - 18 Sep
// 2026" — drops the repeated year on the `from` side when both dates fall
// in the same year, per the example in the design.
export function formatDateRangeLabel(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const fromLabel = fy === ty ? `${fd} ${SHORT_MONTHS_ID[fm - 1]}` : `${fd} ${SHORT_MONTHS_ID[fm - 1]} ${fy}`
  const toLabel = `${td} ${SHORT_MONTHS_ID[tm - 1]} ${ty}`
  return `${fromLabel} - ${toLabel}`
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
