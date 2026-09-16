import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'

export function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) })
}

export function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}
