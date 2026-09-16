<script setup lang="ts">
const fields = [
  { key: 'name', label: 'Name', required: true },
  { key: 'parent_id', label: 'Parent Category ID' },
]
</script>

<template>
  <MasterCrud title="Product Categories" endpoint="/product-categories" :fields="fields" />
</template>
