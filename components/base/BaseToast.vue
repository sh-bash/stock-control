<script setup lang="ts">
// Presentational unit for one toast — the actual queue/auto-dismiss timing
// logic stays in stores/notifications.ts (ToastStack.vue will be wired to
// render this component during the Notification module refactor pass;
// kept separate for now since Step 1 is components only, no page/store
// changes yet).
withDefaults(
  defineProps<{
    severity?: 'danger' | 'warning' | 'info'
    title: string
    message?: string | null
    persistent?: boolean
  }>(),
  { severity: 'info', message: null, persistent: false },
)

defineEmits<{ close: [] }>()
</script>

<template>
  <div class="base-toast" :class="`severity-${severity}`" role="alert">
    <div class="toast-content">
      <div class="toast-title">{{ title }}</div>
      <div v-if="message" class="toast-message">{{ message }}</div>
    </div>
    <button class="toast-close" aria-label="Tutup" @click="$emit('close')">×</button>
  </div>
</template>

<style scoped>
.base-toast {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  color: #fff;
  box-shadow: var(--elevation-3);
  width: 320px;
}
.severity-danger {
  background: var(--color-danger);
}
.severity-warning {
  background: var(--color-warning);
}
.severity-info {
  background: var(--color-info);
}
.toast-title {
  font-weight: 600;
  font-size: 14px;
}
.toast-message {
  font-size: 13px;
  opacity: 0.95;
  margin-top: 2px;
}
.toast-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
</style>
