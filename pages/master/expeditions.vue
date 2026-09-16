<script setup lang="ts">
const fields = [
  { key: 'name', label: 'Name', required: true },
  { key: 'contact', label: 'Contact' },
  {
    key: 'default_allocation_method',
    label: 'Default Allocation Method',
    type: 'select',
    options: [
      { value: 'per_qty', label: 'Per Qty' },
      { value: 'per_value', label: 'Per Value' },
      { value: 'per_weight', label: 'Per Weight' },
    ],
  },
] as const
</script>

<template>
  <MasterCrud title="Expeditions" endpoint="/expeditions" :fields="fields" />
</template>
