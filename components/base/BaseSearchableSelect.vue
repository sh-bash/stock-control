<script setup lang="ts">
interface Option {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: readonly Option[]
    label?: string
    placeholder?: string
  }>(),
  { label: '', placeholder: 'Cari...' },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const query = ref('')
const rootEl = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => props.options.find((o) => o.value === props.modelValue)?.label ?? '')

const filtered = computed(() => {
  if (!query.value) return props.options
  const q = query.value.toLowerCase()
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

function selectOption(opt: Option) {
  emit('update:modelValue', opt.value)
  open.value = false
  query.value = ''
}

function clearSelection() {
  emit('update:modelValue', '')
  query.value = ''
}

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false
    query.value = ''
  }
}
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="rootEl" class="base-field">
    <label v-if="label" class="base-field-label">{{ label }}</label>
    <div class="searchable-select">
      <input
        class="base-field-control"
        type="text"
        :value="open ? query : selectedLabel"
        :placeholder="placeholder"
        @focus="open = true"
        @input="query = ($event.target as HTMLInputElement).value"
      />
      <button v-if="modelValue && !open" type="button" class="ss-clear" aria-label="Hapus" @click="clearSelection">×</button>
      <div v-if="open" class="ss-panel">
        <div v-for="opt in filtered" :key="opt.value" class="ss-option" @mousedown.prevent="selectOption(opt)">
          {{ opt.label }}
        </div>
        <div v-if="filtered.length === 0" class="ss-empty">Tidak ditemukan</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.searchable-select {
  position: relative;
}
.ss-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
}
.ss-panel {
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
.ss-option {
  padding: 7px 12px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
}
.ss-option:hover {
  background: var(--color-bg);
}
.ss-empty {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
