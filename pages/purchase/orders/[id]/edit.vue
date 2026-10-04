<script setup lang="ts">
const id = useRoute().params.id as string
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Purchase Order', to: '/purchase/orders' }, { label: 'Ubah' }]" />
    <BasePageHeader title="Ubah Purchase Order" />
    <PoForm :id="id" />
  </div>
</template>
