<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
  },
)

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    class="base-btn"
    :class="[`variant-${variant}`, `size-${size}`, { block, 'is-loading': loading }]"
    :disabled="disabled || loading"
    @click="(e) => $emit('click', e)"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <span class="btn-label"><slot /></span>
  </button>
</template>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
}
.base-btn.block {
  width: 100%;
}

/* sizes */
.size-sm {
  padding: 6px 12px;
  font-size: 12px;
}
.size-md {
  padding: 9px 16px;
  font-size: 14px;
}
.size-lg {
  padding: 12px 20px;
  font-size: 15px;
}

/* variants */
.variant-primary {
  background: var(--color-info);
  color: #fff;
}
.variant-secondary {
  background: var(--color-neutral-bg);
  color: var(--color-text);
}
.variant-danger {
  background: var(--color-danger);
  color: #fff;
}
.variant-ghost {
  background: transparent;
  color: var(--color-info);
  border-color: transparent;
}
.variant-ghost:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.08);
}

.base-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  filter: none;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: base-btn-spin 0.6s linear infinite;
}
.variant-secondary .spinner,
.variant-ghost .spinner {
  border: 2px solid rgba(37, 99, 235, 0.3);
  border-top-color: var(--color-info);
}
.is-loading .btn-label {
  opacity: 0.85;
}

@keyframes base-btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
