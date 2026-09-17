<script setup lang="ts">
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
  }>(),
  {
    label: '',
    placeholder: '- Pilih -',
    error: null,
    helperText: null,
    required: false,
    disabled: false,
  },
)

defineEmits<{ 'update:modelValue': [string] }>()

const uid = useId()
</script>

<template>
  <div class="base-field">
    <label v-if="label" :for="uid" class="base-field-label">
      {{ label }}
      <span v-if="required" class="base-field-required">*</span>
    </label>
    <select
      :id="uid"
      class="base-field-control"
      :class="{ 'has-error': error }"
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <span v-if="error" class="base-field-error">{{ error }}</span>
    <span v-else-if="helperText" class="base-field-helper">{{ helperText }}</span>
  </div>
</template>
