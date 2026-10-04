// Loads the small master lists every document page needs for dropdowns and
// id → label lookups. Fetched once per page mount (they are small).
export interface Supplier { id: string; name: string; default_lead_time_days?: number }
export interface Warehouse { id: string; code: string; name: string }
export interface Product { id: string; sku: string; name: string }
export interface Expedition { id: string; name: string; default_allocation_method?: string }
export interface UserLite { id: string; name: string; email?: string }

type MasterKey = 'suppliers' | 'warehouses' | 'products' | 'expeditions' | 'users'

export function useMasters() {
  const suppliers = ref<Supplier[]>([])
  const warehouses = ref<Warehouse[]>([])
  const products = ref<Product[]>([])
  const expeditions = ref<Expedition[]>([])
  const users = ref<UserLite[]>([])

  async function loadMasters(which: MasterKey[] = ['suppliers', 'warehouses', 'products']) {
    const jobs: Promise<void>[] = []
    const run = <T>(key: MasterKey, target: Ref<T[]>, url: string) => {
      if (which.includes(key)) jobs.push(useApi<T[]>(url).then((d) => { target.value = d }))
    }
    run('suppliers', suppliers, '/suppliers')
    run('warehouses', warehouses, '/warehouses')
    run('products', products, '/products')
    run('expeditions', expeditions, '/expeditions')
    run('users', users, '/users')
    await Promise.all(jobs)
  }

  const supplierName = (id?: string | null) => suppliers.value.find((s) => s.id === id)?.name || id || '-'
  const warehouseName = (id?: string | null) => warehouses.value.find((w) => w.id === id)?.name || id || '-'
  const expeditionName = (id?: string | null) => expeditions.value.find((e) => e.id === id)?.name || id || '-'
  const userName = (id?: string | null) => users.value.find((u) => u.id === id)?.name || id || '-'
  const productLabel = (id?: string | null) => {
    const p = products.value.find((p) => p.id === id)
    return p ? `${p.sku} - ${p.name}` : id || '-'
  }

  // Server-side product search for BaseAsyncSelect.
  async function fetchProductOptions(query: string) {
    const res = await useApiEnvelope<Product[]>('/products', { query: { page: 1, pageSize: 20, search: query } })
    return res.data.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))
  }

  return {
    suppliers,
    warehouses,
    products,
    expeditions,
    users,
    loadMasters,
    supplierName,
    warehouseName,
    expeditionName,
    userName,
    productLabel,
    fetchProductOptions,
  }
}
