// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      // Daily at 01:00 — movement classification (§6.5) and aging check
      '0 1 * * *': ['movement-classification', 'aging-check'],
      // Weekly, Sunday 02:00 — stock reconciliation
      '0 2 * * 0': ['stock-reconciliation'],
    },
  },
})
