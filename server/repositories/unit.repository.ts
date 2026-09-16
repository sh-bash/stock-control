import { units } from '../db/schema'
import { listAll, getById, insertOne, updateById, deleteById } from '../utils/crud'

export const list = () => listAll(units)
export const find = (id: string) => getById(units, units.id, id)
export const create = (values: Record<string, unknown>) => insertOne(units, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(units, units.id, id, values)
export const remove = (id: string) => deleteById(units, units.id, id)
