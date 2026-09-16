import { verifyAccessToken } from '../utils/jwt'

const PUBLIC_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/v1/')) return
  if (PUBLIC_PATHS.includes(path)) return

  const authHeader = getHeader(event, 'authorization')
  const queryToken = path === '/api/v1/notifications/stream' ? getQuery(event).token : undefined

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : (typeof queryToken === 'string' ? queryToken : undefined)

  if (!token) {
    throw createError({
      statusCode: 401,
      data: { success: false, data: null, message: 'Token tidak ditemukan', meta: { code: 'UNAUTHORIZED' } },
    })
  }

  try {
    const payload = verifyAccessToken(token)
    event.context.auth = payload
  } catch {
    throw createError({
      statusCode: 401,
      data: { success: false, data: null, message: 'Token tidak valid atau kedaluwarsa', meta: { code: 'UNAUTHORIZED' } },
    })
  }
})
