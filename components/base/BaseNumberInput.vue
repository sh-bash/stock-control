<script setup lang="ts">
// For qty/price fields specifically: rejects negative input (unless
// explicitly allowed, e.g. Stock Adjustment's qty_diff) and shows a
// thousands-separated display when not focused, editing the raw number
// while focused so the cursor never fights the formatter mid-keystroke.
const props = withDefaults(
  defineProps<{
    modelValue: number | null
    label?: string
    placeholder?: string
    error?: string | null
    helperText?: string | null
    required?: boolean
    disabled?: boolean
    allowNegative?: boolean
    min?: number
    max?: number
    step?: number | 'any'
  }>(),
  {
    label: '',
    placeholder: '',
    error: null,
    helperText: null,
    required: false,
    disabled: false,
    allowNegative: false,
    min: undefined,
    max: undefined,
    step: 'any',
  },
)

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const uid = useId()
const focused = ref(false)
const rawText = ref(props.modelValue != null ? String(props.modelValue) : '')

watch(
  () => props.modelValue,
  (val) => {
    if (!focused.value) rawText.value = val != null ? String(val) : ''
  },
)

const displayValue = computed(() => {
  if (focused.value) return rawText.value
  if (props.modelValue == null || Number.isNaN(props.modelValue)) return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(props.modelValue)
})

function onFocus() {
  focused.value = true
  rawText.value = props.modelValue != null ? String(props.modelValue) : ''
}

function onInput(e: Event) {
  rawText.value = (e.target as HTMLInputElement).value
  const parsed = rawText.value === '' ? null : Number(rawText.value)
  if (parsed !== null && !props.allowNegative && parsed < 0) return
  emit('update:modelValue', parsed !== null && Number.isNaN(parsed) ? null : parsed)
}

function onBlur() {
  focused.value = false
}
</script>

<template>
  <div class="base-field">
    <label v-if="label" :for="uid" class="base-field-label">
      {{ label }}
      <span v-if="required" class="base-field-required">*</span>
    </label>
    <input
      :id="uid"
      class="base-field-control"
      :class="{ 'has-error': error }"
      :type="focused ? 'number' : 'text'"
      inputmode="decimal"
      :min="allowNegative ? min : Math.max(min ?? 0, 0)"
      :max="max"
      :step="step"
      :value="displayValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      @focus="onFocus"
      @input="onInput"
      @blur="onBlur"
    />
    <span v-if="error" class="base-field-error">{{ error }}</span>
    <span v-else-if="helperText" class="base-field-helper">{{ helperText }}</span>
  </div>
</template>
