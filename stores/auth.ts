import { defineStore } from 'pinia'

interface AuthUser {
  id: string
  name: string
  email: string
  role_id: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null as string | null,
    refreshToken: null as string | null,
    user: null as AuthUser | null,
  }),
  actions: {
    hydrate() {
      if (import.meta.client) {
        this.accessToken = localStorage.getItem('accessToken')
        this.refreshToken = localStorage.getItem('refreshToken')
        const userStr = localStorage.getItem('authUser')
        this.user = userStr ? JSON.parse(userStr) : null
      }
    },
    setSession(accessToken: string, refreshToken: string, user?: AuthUser) {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      if (user) this.user = user
      if (import.meta.client) {
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        if (user) localStorage.setItem('authUser', JSON.stringify(user))
      }
    },
    clearSession() {
      this.accessToken = null
      this.refreshToken = null
      this.user = null
      if (import.meta.client) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('authUser')
      }
    },
  },
})
