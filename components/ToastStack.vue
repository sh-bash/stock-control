<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications'

const store = useNotificationStore()
</script>

<template>
  <div class="toast-stack">
    <TransitionGroup name="toast-slide">
      <BaseToast
        v-for="toast in store.toasts"
        :key="toast.id"
        :severity="toast.severity"
        :title="toast.title"
        :message="toast.message"
        :persistent="toast.persistent"
        @close="store.dismissToast(toast.id)"
      />
    </TransitionGroup>
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
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 200ms ease-in-out;
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
.toast-slide-leave-active {
  position: absolute;
  right: 0;
}
</style>
