<script setup lang="ts">
interface Option {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: readonly string[]
    options: readonly Option[]
    label?: string
    placeholder?: string
  }>(),
  { label: '', placeholder: 'Semua' },
)

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

function toggleOption(value: string) {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter((v) => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

const summary = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder
  if (props.modelValue.length === 1) {
    return props.options.find((o) => o.value === props.modelValue[0])?.label ?? props.modelValue[0]
  }
  return `${props.modelValue.length} dipilih`
})

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="rootEl" class="base-field">
    <label v-if="label" class="base-field-label">{{ label }}</label>
    <div class="multiselect">
      <button type="button" class="base-field-control multiselect-trigger" @click="open = !open">
        <span :class="{ placeholder: modelValue.length === 0 }">{{ summary }}</span>
        <span class="ms-chevron" :class="{ open }">▾</span>
      </button>
      <div v-if="open" class="multiselect-panel">
        <label v-for="opt in options" :key="opt.value" class="ms-option">
          <input type="checkbox" :checked="modelValue.includes(opt.value)" @change="toggleOption(opt.value)" />
          {{ opt.label }}
        </label>
        <div v-if="options.length === 0" class="ms-empty">Tidak ada opsi</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.multiselect {
  position: relative;
}
.multiselect-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  background: var(--color-surface);
}
.multiselect-trigger .placeholder {
  color: var(--color-text-muted);
}
.ms-chevron {
  font-size: 10px;
  color: var(--color-text-muted);
  transition: transform 150ms ease-in-out;
  flex-shrink: 0;
}
.ms-chevron.open {
  transform: rotate(180deg);
}
.multiselect-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 40;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-2);
  max-height: 220px;
  overflow-y: auto;
  padding: 6px 0;
}
.ms-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
}
.ms-option:hover {
  background: var(--color-bg);
}
.ms-empty {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
