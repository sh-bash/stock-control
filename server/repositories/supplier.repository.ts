import { suppliers } from '../db/schema'
import { listAll, getById, insertOne, updateById, deleteById } from '../utils/crud'

export const list = () => listAll(suppliers)
export const find = (id: string) => getById(suppliers, suppliers.id, id)
export const create = (values: Record<string, unknown>) => insertOne(suppliers, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(suppliers, suppliers.id, id, values)
export const remove = (id: string) => deleteById(suppliers, suppliers.id, id)
