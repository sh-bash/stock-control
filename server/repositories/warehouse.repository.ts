import { warehouses } from '../db/schema'
import { listAll, listPaged, getById, insertOne, updateById, deleteById, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = { code: warehouses.code, name: warehouses.name, type: warehouses.type }

export const list = () => listAll(warehouses)
export const listPage = (opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string }) =>
  listPaged(warehouses, {
    ...opts,
    searchColumns: [warehouses.code, warehouses.name],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || warehouses.name,
    statusColumn: warehouses.is_active,
  })
export const find = (id: string) => getById(warehouses, warehouses.id, id)
export const create = (values: Record<string, unknown>) => insertOne(warehouses, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(warehouses, warehouses.id, id, values)
export const remove = (id: string) => deleteById(warehouses, warehouses.id, id)
