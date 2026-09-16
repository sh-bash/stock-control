<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications'

const store = useNotificationStore()
const open = ref(false)

onMounted(() => {
  store.load().catch(() => {})
})

function toggle() {
  open.value = !open.value
}

function handleClickItem(recipientId: string, isRead: boolean) {
  if (!isRead) store.markRead(recipientId).catch(() => {})
}

function severityColor(severity: string) {
  if (severity === 'danger') return '#dc2626'
  if (severity === 'warning') return '#ea580c'
  return '#2563eb'
}
</script>

<template>
  <div class="bell-wrapper">
    <button class="bell-btn" @click="toggle">
      🔔
      <span v-if="store.unreadCount > 0" class="badge">{{ store.unreadCount }}</span>
    </button>
    <div v-if="open" class="dropdown">
      <div class="dropdown-header">Notifications</div>
      <div v-if="store.items.length === 0" class="empty">Tidak ada notifikasi</div>
      <div
        v-for="item in store.items"
        :key="item.recipient_id"
        class="notif-item"
        :class="{ unread: !item.is_read }"
        @click="handleClickItem(item.recipient_id, item.is_read)"
      >
        <div class="dot" :style="{ background: severityColor(item.notification.severity) }" />
        <div class="notif-body">
          <div class="notif-title">{{ item.notification.title }}</div>
          <div class="notif-message">{{ item.notification.message }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bell-wrapper {
  position: relative;
}
.bell-btn {
  position: relative;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #fff;
}
.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 999px;
}
.dropdown {
  position: absolute;
  right: 0;
  top: 32px;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: #fff;
  color: #0f172a;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 50;
}
.dropdown-header {
  padding: 12px;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}
.empty {
  padding: 16px;
  color: #64748b;
  font-size: 13px;
}
.notif-item {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
}
.notif-item.unread {
  background: #f8fafc;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.notif-title {
  font-size: 13px;
  font-weight: 600;
}
.notif-message {
  font-size: 12px;
  color: #475569;
}
</style>
