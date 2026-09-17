import { customers } from '../db/schema'
import { listAll, listPaged, getById, insertOne, updateById, deleteById, type PagedListOptions } from '../utils/crud'

const SORT_COLUMNS: Record<string, any> = { name: customers.name, payment_term_days: customers.payment_term_days }

export const list = () => listAll(customers)
export const listPage = (opts: Omit<PagedListOptions, 'searchColumns' | 'sortColumn'> & { sortBy?: string }) =>
  listPaged(customers, {
    ...opts,
    searchColumns: [customers.name, customers.contact, customers.phone],
    sortColumn: (opts.sortBy && SORT_COLUMNS[opts.sortBy]) || customers.name,
    statusColumn: customers.is_active,
  })
export const find = (id: string) => getById(customers, customers.id, id)
export const create = (values: Record<string, unknown>) => insertOne(customers, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(customers, customers.id, id, values)
export const remove = (id: string) => deleteById(customers, customers.id, id)
