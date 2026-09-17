import { products } from '../db/schema'
import { listAll, listPaged, getById, insertOne, updateById, deleteById, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = { sku: products.sku, name: products.name, costing_method: products.costing_method }

export const list = () => listAll(products)
export const listPage = (opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string }) =>
  listPaged(products, {
    ...opts,
    searchColumns: [products.sku, products.name],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || products.name,
    statusColumn: products.is_active,
  })
export const find = (id: string) => getById(products, products.id, id)
export const create = (values: Record<string, unknown>) => insertOne(products, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(products, products.id, id, values)
export const remove = (id: string) => deleteById(products, products.id, id)
