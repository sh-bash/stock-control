<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications'

const store = useNotificationStore()
</script>

<template>
  <div class="toast-stack">
    <BaseToast
      v-for="toast in store.toasts"
      :key="toast.id"
      :severity="toast.severity"
      :title="toast.title"
      :message="toast.message"
      :persistent="toast.persistent"
      @close="store.dismissToast(toast.id)"
    />
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
}
</style>
