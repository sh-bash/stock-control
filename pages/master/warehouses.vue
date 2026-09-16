<script setup lang="ts">
const fields = [
  { key: 'code', label: 'Code', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'type', label: 'Type' },
  { key: 'address', label: 'Address' },
]
</script>

<template>
  <MasterCrud title="Warehouses" endpoint="/warehouses" :fields="fields" />
</template>
