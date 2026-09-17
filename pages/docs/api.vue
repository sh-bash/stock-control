<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  title: 'API Docs — stock_control',
  link: [{ rel: 'stylesheet', href: '/swagger-ui/swagger-ui.css' }],
})

onMounted(() => {
  const bundle = document.createElement('script')
  bundle.src = '/swagger-ui/swagger-ui-bundle.js'
  bundle.onload = () => {
    const preset = document.createElement('script')
    preset.src = '/swagger-ui/swagger-ui-standalone-preset.js'
    preset.onload = () => {
      // @ts-expect-error global injected by the bundle script above
      window.SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          // @ts-expect-error same
          window.SwaggerUIBundle.presets.apis,
          // @ts-expect-error same
          window.SwaggerUIStandalonePreset,
        ],
        layout: 'StandaloneLayout',
      })
    }
    document.body.appendChild(preset)
  }
  document.body.appendChild(bundle)
})
</script>

<template>
  <div id="swagger-ui" />
</template>
