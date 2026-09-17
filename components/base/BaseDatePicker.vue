<script setup lang="ts">
// Thin wrapper over the native date input rather than a custom picker
// widget — keeps the value format identical to what every date-column
// field in this app already expects ("YYYY-MM-DD" strings), with zero
// extra dependency weight.
withDefaults(
  defineProps<{
    modelValue: string | null
    label?: string
    error?: string | null
    helperText?: string | null
    required?: boolean
    disabled?: boolean
    min?: string
    max?: string
  }>(),
  {
    label: '',
    error: null,
    helperText: null,
    required: false,
    disabled: false,
    min: undefined,
    max: undefined,
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
    <input
      :id="uid"
      type="date"
      class="base-field-control"
      :class="{ 'has-error': error }"
      :value="modelValue"
      :min="min"
      :max="max"
      :disabled="disabled"
      :required="required"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="base-field-error">{{ error }}</span>
    <span v-else-if="helperText" class="base-field-helper">{{ helperText }}</span>
  </div>
</template>
