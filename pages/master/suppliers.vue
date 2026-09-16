<script setup lang="ts">
const fields = [
  { key: 'name', label: 'Name', required: true },
  { key: 'contact', label: 'Contact' },
  { key: 'phone', label: 'Phone' },
  { key: 'payment_term_days', label: 'Payment Term (days)', type: 'number' },
  { key: 'default_lead_time_days', label: 'Lead Time (days)', type: 'number' },
] as const
</script>

<template>
  <MasterCrud title="Suppliers" endpoint="/suppliers" :fields="fields" />
</template>
