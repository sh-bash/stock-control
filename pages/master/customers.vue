<script setup lang="ts">
const fields = [
  { key: 'name', label: 'Name', required: true },
  { key: 'contact', label: 'Contact' },
  { key: 'phone', label: 'Phone' },
  { key: 'payment_term_days', label: 'Payment Term (days)', type: 'number' },
  { key: 'price_level_id', label: 'Price Level ID' },
] as const
</script>

<template>
  <MasterCrud title="Customers" endpoint="/customers" :fields="fields" />
</template>
