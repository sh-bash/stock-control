import { units } from '../db/schema'
import { listAll, listPaged, getById, insertOne, updateById, deleteById, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = { name: units.name }

export const list = () => listAll(units)
export const listPage = (opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string }) =>
  listPaged(units, {
    ...opts,
    searchColumns: [units.name],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || units.name,
  })
export const find = (id: string) => getById(units, units.id, id)
export const create = (values: Record<string, unknown>) => insertOne(units, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(units, units.id, id, values)
export const remove = (id: string) => deleteById(units, units.id, id)
