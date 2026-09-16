<script setup lang="ts">
const fields = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'category_id', label: 'Category ID' },
  { key: 'base_unit_id', label: 'Base Unit ID' },
  { key: 'costing_method', label: 'Costing Method' },
]
</script>

<template>
  <MasterCrud title="Products" endpoint="/products" :fields="fields" />
</template>
