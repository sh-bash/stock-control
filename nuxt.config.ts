// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css', 'driver.js/dist/driver.css', 'sweetalert2/dist/sweetalert2.min.css'],
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      // Daily at 00:30 — inventory valuation snapshot, ahead of the other
      // daily jobs so classification/aging run against the freshest day
      '30 0 * * *': ['stock-valuation-snapshot'],
      // Daily at 01:00 — movement classification (§6.5) and aging check
      '0 1 * * *': ['movement-classification', 'aging-check'],
      // Weekly, Sunday 02:00 — stock reconciliation
      '0 2 * * 0': ['stock-reconciliation'],
    },
  },
})
