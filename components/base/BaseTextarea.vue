<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string | null
    label?: string
    placeholder?: string
    error?: string | null
    helperText?: string | null
    required?: boolean
    disabled?: boolean
    rows?: number
  }>(),
  {
    label: '',
    placeholder: '',
    error: null,
    helperText: null,
    required: false,
    disabled: false,
    rows: 3,
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
    <textarea
      :id="uid"
      class="base-field-control"
      :class="{ 'has-error': error }"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <span v-if="error" class="base-field-error">{{ error }}</span>
    <span v-else-if="helperText" class="base-field-helper">{{ helperText }}</span>
  </div>
</template>

<style scoped>
textarea.base-field-control {
  resize: vertical;
  font-family: inherit;
}
</style>
