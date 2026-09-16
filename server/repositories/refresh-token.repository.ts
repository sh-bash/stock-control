import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { refreshTokens } from '../db/schema'

export function createRefreshToken(data: { user_id: string; token_hash: string; expires_at: Date }) {
  return db.insert(refreshTokens).values(data).returning()
}

export function findActiveRefreshTokenByHash(token_hash: string) {
  return db.query.refreshTokens.findFirst({
    where: and(eq(refreshTokens.token_hash, token_hash), isNull(refreshTokens.revoked_at)),
  })
}

export function revokeRefreshToken(id: string) {
  return db.update(refreshTokens).set({ revoked_at: new Date() }).where(eq(refreshTokens.id, id))
}
