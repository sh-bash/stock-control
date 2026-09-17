import { suppliers } from '../db/schema'
import { listAll, listPaged, getById, insertOne, updateById, deleteById, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = {
  name: suppliers.name,
  payment_term_days: suppliers.payment_term_days,
  default_lead_time_days: suppliers.default_lead_time_days,
}

export const list = () => listAll(suppliers)
export const listPage = (opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string }) =>
  listPaged(suppliers, {
    ...opts,
    searchColumns: [suppliers.name, suppliers.contact, suppliers.phone],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || suppliers.name,
    statusColumn: suppliers.is_active,
  })
export const find = (id: string) => getById(suppliers, suppliers.id, id)
export const create = (values: Record<string, unknown>) => insertOne(suppliers, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(suppliers, suppliers.id, id, values)
export const remove = (id: string) => deleteById(suppliers, suppliers.id, id)
