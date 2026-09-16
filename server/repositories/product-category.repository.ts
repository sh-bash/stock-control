import { productCategories } from '../db/schema'
import { listAll, getById, insertOne, updateById, deleteById } from '../utils/crud'

export const list = () => listAll(productCategories)
export const find = (id: string) => getById(productCategories, productCategories.id, id)
export const create = (values: Record<string, unknown>) => insertOne(productCategories, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(productCategories, productCategories.id, id, values)
export const remove = (id: string) => deleteById(productCategories, productCategories.id, id)
