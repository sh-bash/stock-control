<script setup lang="ts">
// Every dropdown in the app is a searchable select: BaseSelect keeps its old
// API (so existing pages need no change) but renders BaseSearchableSelect —
// type to filter, click to pick, × to clear.
interface Option {
  value: string
  label: string
}

withDefaults(
  defineProps<{
    modelValue: string | null
    label?: string
    options: readonly Option[]
    placeholder?: string
    error?: string | null
    helperText?: string | null
    required?: boolean
    disabled?: boolean
    clearable?: boolean
  }>(),
  {
    label: '',
    placeholder: '- Pilih -',
    error: null,
    helperText: null,
    required: false,
    disabled: false,
    clearable: true,
  },
)

defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <BaseSearchableSelect
    :model-value="modelValue ?? ''"
    :label="label"
    :options="options"
    :placeholder="placeholder"
    :error="error"
    :helper-text="helperText"
    :required="required"
    :disabled="disabled"
    :clearable="clearable"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  />
</template>
