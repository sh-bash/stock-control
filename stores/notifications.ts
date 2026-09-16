import { defineStore } from 'pinia'

export interface AppNotification {
  recipient_id: string
  is_read: boolean
  read_at: string | null
  notification: {
    id: string
    type: string
    severity: 'info' | 'warning' | 'danger'
    title: string
    message: string
    created_at: string
  }
}

export interface ToastItem {
  id: string
  severity: 'info' | 'warning' | 'danger'
  title: string
  message: string
  persistent: boolean
}

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    items: [] as AppNotification[],
    toasts: [] as ToastItem[],
    eventSource: null as EventSource | null,
  }),
  getters: {
    unreadCount: (state) => state.items.filter((i) => !i.is_read).length,
  },
  actions: {
    async load() {
      this.items = await useApi<AppNotification[]>('/notifications')
    },
    async markRead(recipientId: string) {
      await useApi(`/notifications/${recipientId}/read`, { method: 'POST' })
      const item = this.items.find((i) => i.recipient_id === recipientId)
      if (item) {
        item.is_read = true
        item.read_at = new Date().toISOString()
      }
    },
    pushToast(payload: { severity: 'info' | 'warning' | 'danger'; title: string; message: string }) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const persistent = payload.severity === 'danger'
      this.toasts.push({ id, ...payload, persistent })
      if (!persistent) {
        setTimeout(() => this.dismissToast(id), 6000)
      }
    },
    dismissToast(id: string) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
    connect(accessToken: string) {
      if (!import.meta.client || this.eventSource) return
      const es = new EventSource(`/api/v1/notifications/stream?token=${encodeURIComponent(accessToken)}`)

      es.addEventListener('notification', (evt: MessageEvent) => {
        const payload = JSON.parse(evt.data) as { recipient_id: string; notification: AppNotification['notification'] }
        this.items.unshift({
          recipient_id: payload.recipient_id,
          is_read: false,
          read_at: null,
          notification: payload.notification,
        })
        this.pushToast({
          severity: payload.notification.severity,
          title: payload.notification.title,
          message: payload.notification.message,
        })
      })

      es.onerror = () => {
        es.close()
        this.eventSource = null
        setTimeout(() => this.connect(accessToken), 5000)
      }

      this.eventSource = es
    },
    disconnect() {
      this.eventSource?.close()
      this.eventSource = null
    },
  },
})
