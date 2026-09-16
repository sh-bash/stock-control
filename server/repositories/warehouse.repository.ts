import { warehouses } from '../db/schema'
import { listAll, getById, insertOne, updateById, deleteById } from '../utils/crud'

export const list = () => listAll(warehouses)
export const find = (id: string) => getById(warehouses, warehouses.id, id)
export const create = (values: Record<string, unknown>) => insertOne(warehouses, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(warehouses, warehouses.id, id, values)
export const remove = (id: string) => deleteById(warehouses, warehouses.id, id)
