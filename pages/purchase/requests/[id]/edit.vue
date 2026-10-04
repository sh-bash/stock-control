<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Product Request', to: '/purchase/requests' }, { label: 'Ubah' }]" />
    <BasePageHeader title="Ubah Product Request" />
    <RequestForm :id="id" />
  </div>
</template>
