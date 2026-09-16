import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { findUserByEmail, findUserById } from '../repositories/user.repository'
import {
  createRefreshToken,
  findActiveRefreshTokenByHash,
  revokeRefreshToken,
} from '../repositories/refresh-token.repository'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { failure } from '../utils/response'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function refreshExpiryDate() {
  const days = parseInt((process.env.JWT_REFRESH_EXPIRES_IN || '14d').replace('d', ''), 10) || 14
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email)
  if (!user || !user.is_active) {
    failure('Email atau password salah', 'INVALID_CREDENTIALS', 401)
  }

  const valid = await bcrypt.compare(password, user!.password_hash)
  if (!valid) {
    failure('Email atau password salah', 'INVALID_CREDENTIALS', 401)
  }

  const accessToken = signAccessToken({ sub: user!.id, role_id: user!.role_id, email: user!.email })
  const refreshToken = signRefreshToken({ sub: user!.id })

  await createRefreshToken({
    user_id: user!.id,
    token_hash: hashToken(refreshToken),
    expires_at: refreshExpiryDate(),
  })

  return {
    accessToken,
    refreshToken,
    user: { id: user!.id, name: user!.name, email: user!.email, role_id: user!.role_id },
  }
}

export async function refresh(refreshToken: string) {
  let payload: { sub: string }
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    return failure('Refresh token tidak valid', 'INVALID_REFRESH_TOKEN', 401)
  }

  const tokenHash = hashToken(refreshToken)
  const stored = await findActiveRefreshTokenByHash(tokenHash)
  if (!stored || stored.expires_at < new Date()) {
    return failure('Refresh token tidak valid atau sudah revoked', 'INVALID_REFRESH_TOKEN', 401)
  }

  const user = await findUserById(payload.sub)
  if (!user || !user.is_active) {
    return failure('User tidak ditemukan', 'INVALID_REFRESH_TOKEN', 401)
  }

  await revokeRefreshToken(stored.id)

  const newAccessToken = signAccessToken({ sub: user.id, role_id: user.role_id, email: user.email })
  const newRefreshToken = signRefreshToken({ sub: user.id })

  await createRefreshToken({
    user_id: user.id,
    token_hash: hashToken(newRefreshToken),
    expires_at: refreshExpiryDate(),
  })

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken)
  const stored = await findActiveRefreshTokenByHash(tokenHash)
  if (stored) {
    await revokeRefreshToken(stored.id)
  }
}
