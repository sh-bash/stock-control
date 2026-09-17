import { expeditions } from '../db/schema'
import { listAll, listPaged, getById, insertOne, updateById, deleteById, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = { name: expeditions.name, default_allocation_method: expeditions.default_allocation_method }

export const list = () => listAll(expeditions)
export const listPage = (opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string }) =>
  listPaged(expeditions, {
    ...opts,
    searchColumns: [expeditions.name, expeditions.contact],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || expeditions.name,
    statusColumn: expeditions.is_active,
  })
export const find = (id: string) => getById(expeditions, expeditions.id, id)
export const create = (values: Record<string, unknown>) => insertOne(expeditions, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(expeditions, expeditions.id, id, values)
export const remove = (id: string) => deleteById(expeditions, expeditions.id, id)
