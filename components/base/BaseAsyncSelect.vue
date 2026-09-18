<script setup lang="ts">
// Debounced server-side search for large option sets (Product can run into
// the hundreds of SKUs) — unlike BaseSearchableSelect, this never loads the
// full list up front. `fetchOptions` is caller-supplied so this component
// stays endpoint-agnostic (Products, or any other big list later).
interface Option {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    modelLabel?: string | null
    label?: string
    placeholder?: string
    minChars?: number
    debounceMs?: number
    required?: boolean
    error?: string | null
    fetchOptions: (query: string) => Promise<Option[]>
  }>(),
  { label: '', placeholder: 'Ketik untuk mencari...', minChars: 2, debounceMs: 300, modelLabel: null, required: false, error: null },
)

const emit = defineEmits<{ 'update:modelValue': [string]; 'update:modelLabel': [string] }>()

const open = ref(false)
const query = ref('')
const loading = ref(false)
const options = ref<Option[]>([])
const searched = ref(false)
const rootEl = ref<HTMLElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let requestSeq = 0

const selectedLabel = computed(() => props.modelLabel ?? '')

watch(query, (val) => {
  clearTimeout(debounceTimer)
  if (val.length < props.minChars) {
    options.value = []
    searched.value = false
    loading.value = false
    return
  }
  loading.value = true
  debounceTimer = setTimeout(async () => {
    const seq = ++requestSeq
    try {
      const res = await props.fetchOptions(val)
      if (seq !== requestSeq) return // a newer keystroke's request already landed
      options.value = res
      searched.value = true
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }, props.debounceMs)
})

function selectOption(opt: Option) {
  emit('update:modelValue', opt.value)
  emit('update:modelLabel', opt.label)
  open.value = false
  query.value = ''
  options.value = []
  searched.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
  emit('update:modelLabel', '')
}

function onFocus() {
  open.value = true
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
    <label v-if="label" class="base-field-label">
      {{ label }}
      <span v-if="required" class="base-field-required">*</span>
    </label>
    <div class="async-select">
      <input
        class="base-field-control"
        :class="{ 'has-error': error }"
        type="text"
        :value="open ? query : selectedLabel"
        :placeholder="placeholder"
        @focus="onFocus"
        @input="query = ($event.target as HTMLInputElement).value"
      />
      <button v-if="modelValue && !open" type="button" class="as-clear" aria-label="Hapus" @click="clearSelection">×</button>
      <div v-if="open" class="as-panel">
        <div v-if="query.length < minChars" class="as-hint">Ketik minimal {{ minChars }} karakter...</div>
        <div v-else-if="loading" class="as-loading">
          <span class="as-spinner" /> Mencari...
        </div>
        <template v-else>
          <div v-for="opt in options" :key="opt.value" class="as-option" @mousedown.prevent="selectOption(opt)">
            {{ opt.label }}
          </div>
          <div v-if="searched && options.length === 0" class="as-empty">Tidak ditemukan</div>
        </template>
      </div>
    </div>
    <span v-if="error" class="base-field-error">{{ error }}</span>
  </div>
</template>

<style scoped>
.async-select {
  position: relative;
}
.as-clear {
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
.as-panel {
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
.as-option {
  padding: 7px 12px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
}
.as-option:hover {
  background: var(--color-bg);
}
.as-empty,
.as-hint {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.as-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.as-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-neutral-bg);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: as-spin 0.6s linear infinite;
}
@keyframes as-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
