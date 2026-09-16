import { customers } from '../db/schema'
import { listAll, getById, insertOne, updateById, deleteById } from '../utils/crud'

export const list = () => listAll(customers)
export const find = (id: string) => getById(customers, customers.id, id)
export const create = (values: Record<string, unknown>) => insertOne(customers, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(customers, customers.id, id, values)
export const remove = (id: string) => deleteById(customers, customers.id, id)
