<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotificationStore } from '~/stores/notifications'

const auth = useAuthStore()
const notifStore = useNotificationStore()
const router = useRouter()

// `tour` marks the first item of each logical group with a data-tour anchor
// (used by useTour's driver.js steps to highlight that section of the
// sidebar) — purely a highlight target, doesn't affect rendering/routing.
const navItems = [
  { to: '/dashboard', label: 'Dashboard', tour: 'nav-dashboard' },
  { to: '/help', label: 'Bantuan / Panduan', tour: 'nav-help' },
  { to: '/master/warehouses', label: 'Warehouses', tour: 'nav-master' },
  { to: '/master/product-categories', label: 'Product Categories' },
  { to: '/master/units', label: 'Units' },
  { to: '/master/products', label: 'Products' },
  { to: '/master/suppliers', label: 'Suppliers' },
  { to: '/master/customers', label: 'Customers' },
  { to: '/master/expeditions', label: 'Expeditions' },
  { to: '/settings/global-stock', label: 'Global Stock Settings', tour: 'nav-settings' },
  { to: '/settings/product-stock-settings', label: 'Product Stock Settings' },
  { to: '/purchase/orders', label: 'Purchase Orders', tour: 'nav-purchase' },
  { to: '/purchase/shipments', label: 'Shipments' },
  { to: '/purchase/receivings', label: 'Receivings' },
  { to: '/purchase/returns', label: 'Purchase Returns' },
  { to: '/sales/orders', label: 'Sale Orders', tour: 'nav-sale' },
  { to: '/sales/deliveries', label: 'Delivery Orders' },
  { to: '/sales/returns', label: 'Sale Returns' },
  { to: '/stock/overview', label: 'Stock Overview', tour: 'nav-stock' },
  { to: '/stock/transfers', label: 'Stock Transfers' },
  { to: '/stock/adjustments', label: 'Stock Adjustments' },
  { to: '/jobs/dashboard', label: 'Scheduled Jobs', tour: 'nav-jobs' },
  { to: '/reports', label: 'Reports', tour: 'nav-reports' },
  { to: '/approval/workflows', label: 'Approval Workflows', tour: 'nav-approval' },
  { to: '/approval/inbox', label: 'Approval Inbox' },
  { to: '/notifications/rules', label: 'Notification Rules', tour: 'nav-notifications' },
]

function handleLogout() {
  notifStore.disconnect()
  auth.clearSession()
  router.push('/login')
}

const { startTour, hasSeenTour, markTourSeen } = useTour()

onMounted(() => {
  if (!auth.accessToken) auth.hydrate()
  if (auth.accessToken) notifStore.connect(auth.accessToken)

  if (!hasSeenTour()) {
    markTourSeen()
    // Give the page (esp. after a fresh login redirect) a moment to settle
    // before highlighting elements, so driver.js doesn't measure a
    // still-transitioning layout.
    setTimeout(() => startTour(), 400)
  }
})
</script>

<template>
  <div class="app-shell">
    <ToastStack />
    <aside class="sidebar">
      <h2>IMS</h2>
      <nav>
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" :data-tour="item.tour">{{ item.label }}</NuxtLink>
      </nav>
      <div class="user-box" v-if="auth.user">
        <div>{{ auth.user.name }}</div>
        <button @click="handleLogout">Logout</button>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <div />
        <button class="tour-btn" data-tour="topbar-help" title="Mulai tour panduan" @click="startTour()">?</button>
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
  gap: 12px;
  padding: 0 16px;
  box-shadow: var(--elevation-1);
  position: relative;
  z-index: 1;
}
.tour-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #475569;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tour-btn:hover {
  background: #334155;
  color: #fff;
}
.content {
  flex: 1;
  padding: 24px;
  background: #f8fafc;
}
</style>
