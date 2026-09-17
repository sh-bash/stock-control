import VueApexCharts from 'vue3-apexcharts'

// .client.ts — ApexCharts touches `window`, so it must never load during
// SSR. Registered globally as <apexchart> per the library's own convention.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueApexCharts)
})
