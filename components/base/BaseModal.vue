<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'fullscreen'
    closeOnBackdrop?: boolean
    closeOnEsc?: boolean
  }>(),
  {
    title: '',
    size: 'md',
    closeOnBackdrop: true,
    closeOnEsc: true,
  },
)

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onBackdropClick() {
  if (props.closeOnBackdrop) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue && props.closeOnEsc) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="base-modal-backdrop">
      <div v-if="modelValue" class="base-modal-backdrop" @mousedown.self="onBackdropClick">
        <Transition name="base-modal-panel" appear>
          <div v-if="modelValue" class="base-modal-panel" :class="`size-${size}`" role="dialog" aria-modal="true">
            <header v-if="title || $slots.header" class="base-modal-header">
              <slot name="header">
                <h2>{{ title }}</h2>
              </slot>
              <button class="base-modal-close" aria-label="Tutup" @click="close">×</button>
            </header>
            <div class="base-modal-body">
              <slot />
            </div>
            <footer v-if="$slots.footer" class="base-modal-footer">
              <slot name="footer" />
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.base-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1100;
}
.base-modal-panel {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 48px);
  width: 100%;
}
.size-sm {
  max-width: 420px;
}
.size-md {
  max-width: 640px;
}
.size-lg {
  max-width: 960px;
}
.size-fullscreen {
  max-width: none;
  width: calc(100vw - 48px);
  height: calc(100vh - 48px);
}
.base-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-neutral-bg);
  flex-shrink: 0;
}
.base-modal-header h2 {
  margin: 0;
  font-size: 16px;
}
.base-modal-close {
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
}
.base-modal-close:hover {
  color: var(--color-text);
}
.base-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.base-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-neutral-bg);
  flex-shrink: 0;
}

/* Material-style fade + scale transition */
.base-modal-backdrop-enter-active,
.base-modal-backdrop-leave-active {
  transition: opacity 0.18s ease;
}
.base-modal-backdrop-enter-from,
.base-modal-backdrop-leave-to {
  opacity: 0;
}
.base-modal-panel-enter-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.2, 0, 0.13, 1.5);
}
.base-modal-panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.base-modal-panel-enter-from,
.base-modal-panel-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}
</style>
