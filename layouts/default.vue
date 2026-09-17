<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotificationStore } from '~/stores/notifications'

const auth = useAuthStore()
const notifStore = useNotificationStore()
const router = useRouter()

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/master/warehouses', label: 'Warehouses' },
  { to: '/master/product-categories', label: 'Product Categories' },
  { to: '/master/units', label: 'Units' },
  { to: '/master/products', label: 'Products' },
  { to: '/master/suppliers', label: 'Suppliers' },
  { to: '/master/customers', label: 'Customers' },
  { to: '/master/expeditions', label: 'Expeditions' },
  { to: '/settings/global-stock', label: 'Global Stock Settings' },
  { to: '/settings/product-stock-settings', label: 'Product Stock Settings' },
  { to: '/purchase/orders', label: 'Purchase Orders' },
  { to: '/purchase/shipments', label: 'Shipments' },
  { to: '/purchase/receivings', label: 'Receivings' },
  { to: '/purchase/returns', label: 'Purchase Returns' },
  { to: '/sales/orders', label: 'Sale Orders' },
  { to: '/sales/deliveries', label: 'Delivery Orders' },
  { to: '/sales/returns', label: 'Sale Returns' },
  { to: '/stock/overview', label: 'Stock Overview' },
  { to: '/stock/transfers', label: 'Stock Transfers' },
  { to: '/stock/adjustments', label: 'Stock Adjustments' },
  { to: '/jobs/dashboard', label: 'Scheduled Jobs' },
  { to: '/reports', label: 'Reports' },
  { to: '/approval/workflows', label: 'Approval Workflows' },
  { to: '/approval/inbox', label: 'Approval Inbox' },
  { to: '/notifications/rules', label: 'Notification Rules' },
]

function handleLogout() {
  notifStore.disconnect()
  auth.clearSession()
  router.push('/login')
}

onMounted(() => {
  if (!auth.accessToken) auth.hydrate()
  if (auth.accessToken) notifStore.connect(auth.accessToken)
})
</script>

<template>
  <div class="app-shell">
    <ToastStack />
    <aside class="sidebar">
      <h2>IMS</h2>
      <nav>
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
      </nav>
      <div class="user-box" v-if="auth.user">
        <div>{{ auth.user.name }}</div>
        <button @click="handleLogout">Logout</button>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <div />
        <NotificationBell />
      </header>
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 220px;
  background: #1e293b;
  color: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sidebar nav a {
  color: #cbd5e1;
  text-decoration: none;
  padding: 8px;
  border-radius: 6px;
}
.sidebar nav a:hover,
.sidebar nav a.router-link-active {
  background: #334155;
  color: #fff;
}
.user-box {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #334155;
}
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: 48px;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 16px;
  box-shadow: var(--elevation-1);
  position: relative;
  z-index: 1;
}
.content {
  flex: 1;
  padding: 24px;
  background: #f8fafc;
}
</style>
