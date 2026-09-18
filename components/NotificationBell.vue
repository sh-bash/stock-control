<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications'

const store = useNotificationStore()
const open = ref(false)
const router = useRouter()

onMounted(() => {
  store.load().catch(() => {})
})

function toggle() {
  open.value = !open.value
}

const unreadItems = computed(() => store.items.filter((i) => !i.is_read))
const readItems = computed(() => store.items.filter((i) => i.is_read))

// document_type/document_id aren't on the notification payload yet on the
// backend for every notification kind, so this falls back to just marking
// read (no navigation) when there's nowhere sensible to send the user.
function handleClickItem(item: (typeof store.items)[number]) {
  if (!item.is_read) store.markRead(item.recipient_id).catch(() => {})
  open.value = false
  const target = (item.notification as any).link
  if (target) router.push(target)
}

function severityColor(severity: string) {
  if (severity === 'danger') return 'var(--color-danger)'
  if (severity === 'warning') return 'var(--color-warning)'
  return 'var(--color-info)'
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
      <template v-else>
        <div v-if="unreadItems.length > 0" class="notif-group-label">Belum dibaca</div>
        <div
          v-for="item in unreadItems"
          :key="item.recipient_id"
          class="notif-item unread"
          @click="handleClickItem(item)"
        >
          <div class="dot" :style="{ background: severityColor(item.notification.severity) }" />
          <div class="notif-body">
            <div class="notif-title">{{ item.notification.title }}</div>
            <div class="notif-message">{{ item.notification.message }}</div>
          </div>
        </div>
        <div v-if="readItems.length > 0" class="notif-group-label">Sudah dibaca</div>
        <div
          v-for="item in readItems"
          :key="item.recipient_id"
          class="notif-item"
          @click="handleClickItem(item)"
        >
          <div class="dot" :style="{ background: severityColor(item.notification.severity) }" />
          <div class="notif-body">
            <div class="notif-title">{{ item.notification.title }}</div>
            <div class="notif-message">{{ item.notification.message }}</div>
          </div>
        </div>
      </template>
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
  background: var(--color-danger);
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
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
  z-index: 50;
}
.dropdown-header {
  padding: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--color-neutral-bg);
}
.notif-group-label {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}
.empty {
  padding: 16px;
  color: var(--color-text-muted);
  font-size: 13px;
}
.notif-item {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-bg);
  cursor: pointer;
}
.notif-item.unread {
  background: var(--color-bg);
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
