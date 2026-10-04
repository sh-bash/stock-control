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
  // Physical specs (also filled automatically when promoted from a Product Comparison).
  { key: 'weight_kg', label: 'Berat (kg)', type: 'number' as const, listHidden: true },
  { key: 'length_cm', label: 'Panjang produk (cm)', type: 'number' as const, listHidden: true },
  { key: 'width_cm', label: 'Lebar produk (cm)', type: 'number' as const, listHidden: true },
  { key: 'height_cm', label: 'Tinggi produk (cm)', type: 'number' as const, listHidden: true },
  { key: 'pack_length_cm', label: 'Panjang kemasan (cm)', type: 'number' as const, listHidden: true },
  { key: 'pack_width_cm', label: 'Lebar kemasan (cm)', type: 'number' as const, listHidden: true },
  { key: 'pack_height_cm', label: 'Tinggi kemasan (cm)', type: 'number' as const, listHidden: true },
  { key: 'notes', label: 'Catatan', listHidden: true },
])
</script>

<template>
  <MasterCrud title="Products" endpoint="/products" :fields="fields" />
</template>
