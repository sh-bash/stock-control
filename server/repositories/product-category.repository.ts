import { productCategories } from '../db/schema'
import { listAll, listPaged, getById, insertOne, updateById, deleteById, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = { name: productCategories.name }

export const list = () => listAll(productCategories)
export const listPage = (opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string }) =>
  listPaged(productCategories, {
    ...opts,
    searchColumns: [productCategories.name],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || productCategories.name,
  })
export const find = (id: string) => getById(productCategories, productCategories.id, id)
export const create = (values: Record<string, unknown>) => insertOne(productCategories, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(productCategories, productCategories.id, id, values)
export const remove = (id: string) => deleteById(productCategories, productCategories.id, id)
