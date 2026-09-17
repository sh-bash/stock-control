import { useAuthStore } from '~/stores/auth'

interface ApiEnvelope<T> {
  success: boolean
  data: T
  message: string | null
  meta: Record<string, unknown>
}

async function callApi<T>(url: string, options: any, auth: ReturnType<typeof useAuthStore>): Promise<ApiEnvelope<T>> {
  return await $fetch<ApiEnvelope<T>>(url, {
    ...options,
    baseURL: '/api/v1',
    headers: {
      ...(options.headers || {}),
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
    },
  })
}

async function withAuthRetry<T>(url: string, options: any, auth: ReturnType<typeof useAuthStore>): Promise<ApiEnvelope<T>> {
  try {
    return await callApi<T>(url, options, auth)
  } catch (err: any) {
    const code = err?.data?.data?.meta?.code
    if (err?.statusCode === 401 && code === 'UNAUTHORIZED' && auth.refreshToken) {
      try {
        const refreshed = await $fetch<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
          '/api/v1/auth/refresh',
          { method: 'POST', body: { refreshToken: auth.refreshToken } },
        )
        auth.setSession(refreshed.data.accessToken, refreshed.data.refreshToken)
        return await callApi<T>(url, options, auth)
      } catch {
        auth.clearSession()
        await navigateTo('/login')
        throw err
      }
    }
    throw err
  }
}

export async function useApi<T = unknown>(url: string, options: any = {}): Promise<T> {
  const auth = useAuthStore()
  const res = await withAuthRetry<T>(url, options, auth)
  return res.data
}

// Same as useApi, but returns the full { data, message, meta } envelope —
// needed by callers that read pagination info from `meta` (e.g.
// BaseDataTable-backed lists reading meta.totalRows), not just `data`.
export async function useApiEnvelope<T = unknown>(url: string, options: any = {}): Promise<ApiEnvelope<T>> {
  const auth = useAuthStore()
  return await withAuthRetry<T>(url, options, auth)
}
