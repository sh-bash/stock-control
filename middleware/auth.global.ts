import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return

  const auth = useAuthStore()
  if (!auth.accessToken) auth.hydrate()

  if (to.path !== '/login' && !auth.accessToken) {
    return navigateTo('/login')
  }
  if (to.path === '/login' && auth.accessToken) {
    return navigateTo('/master/warehouses')
  }
})
