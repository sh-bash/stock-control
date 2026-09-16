<script setup lang="ts">
const fields = [{ key: 'name', label: 'Name', required: true }]
</script>

<template>
  <MasterCrud title="Units" endpoint="/units" :fields="fields" />
</template>
