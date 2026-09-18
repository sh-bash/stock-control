<script setup lang="ts">
interface Category { id: string; name: string }
interface Unit { id: string; name: string }

const categories = ref<Category[]>([])
const units = ref<Unit[]>([])

onMounted(async () => {
  const [c, u] = await Promise.all([useApi<Category[]>('/product-categories'), useApi<Unit[]>('/units')])
  categories.value = c
  units.value = u
})

const fields = computed(() => [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'name', label: 'Name', required: true },
  {
    key: 'category_id',
    label: 'Category',
    type: 'select' as const,
    options: categories.value.map((c) => ({ value: c.id, label: c.name })),
  },
  {
    key: 'base_unit_id',
    label: 'Base Unit',
    type: 'select' as const,
    options: units.value.map((u) => ({ value: u.id, label: u.name })),
  },
  {
    key: 'costing_method',
    label: 'Costing Method',
    type: 'select' as const,
    options: [{ value: 'fifo', label: 'FIFO' }],
  },
])
</script>

<template>
  <MasterCrud title="Products" endpoint="/products" :fields="fields" />
</template>
