import { useAuthStore } from '~/stores/auth'

interface ApiEnvelope<T> {
  success: boolean
  data: T
  message: string | null
  meta: Record<string, unknown>
}

export async function useApi<T = unknown>(url: string, options: any = {}): Promise<T> {
  const auth = useAuthStore()

  async function call(): Promise<any> {
    return await $fetch<ApiEnvelope<T>>(url, {
      ...options,
      baseURL: '/api/v1',
      headers: {
        ...(options.headers || {}),
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
    })
  }

  try {
    const res = await call()
    return res.data
  } catch (err: any) {
    const code = err?.data?.data?.meta?.code
    if (err?.statusCode === 401 && code === 'UNAUTHORIZED' && auth.refreshToken) {
      try {
        const refreshed = await $fetch<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
          '/api/v1/auth/refresh',
          { method: 'POST', body: { refreshToken: auth.refreshToken } },
        )
        auth.setSession(refreshed.data.accessToken, refreshed.data.refreshToken)
        const res = await call()
        return res.data
      } catch {
        auth.clearSession()
        await navigateTo('/login')
        throw err
      }
    }
    throw err
  }
}
