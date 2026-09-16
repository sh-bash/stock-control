import { expeditions } from '../db/schema'
import { listAll, getById, insertOne, updateById, deleteById } from '../utils/crud'

export const list = () => listAll(expeditions)
export const find = (id: string) => getById(expeditions, expeditions.id, id)
export const create = (values: Record<string, unknown>) => insertOne(expeditions, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(expeditions, expeditions.id, id, values)
export const remove = (id: string) => deleteById(expeditions, expeditions.id, id)
