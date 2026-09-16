import { products } from '../db/schema'
import { listAll, getById, insertOne, updateById, deleteById } from '../utils/crud'

export const list = () => listAll(products)
export const find = (id: string) => getById(products, products.id, id)
export const create = (values: Record<string, unknown>) => insertOne(products, values)
export const update = (id: string, values: Record<string, unknown>) => updateById(products, products.id, id, values)
export const remove = (id: string) => deleteById(products, products.id, id)
