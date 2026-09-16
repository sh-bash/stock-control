<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications'

const store = useNotificationStore()

function severityClass(severity: string) {
  return `toast toast-${severity}`
}
</script>

<template>
  <div class="toast-stack">
    <div v-for="toast in store.toasts" :key="toast.id" :class="severityClass(toast.severity)">
      <div class="toast-content">
        <div class="toast-title">{{ toast.title }}</div>
        <div class="toast-message">{{ toast.message }}</div>
      </div>
      <button class="toast-close" @click="store.dismissToast(toast.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1000;
  width: 320px;
}
.toast {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 8px;
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
.toast-danger {
  background: #dc2626;
}
.toast-warning {
  background: #ea580c;
}
.toast-info {
  background: #2563eb;
}
.toast-title {
  font-weight: 600;
  font-size: 14px;
}
.toast-message {
  font-size: 13px;
  opacity: 0.95;
}
.toast-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}
</style>
