<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotificationStore } from '~/stores/notifications'

const auth = useAuthStore()
const notifStore = useNotificationStore()
const router = useRouter()

// `tour` marks the first item of each logical group with a data-tour anchor
// (used by useTour's driver.js steps to highlight that section of the
// sidebar) — purely a highlight target, doesn't affect rendering/routing.
const navGroups = [
  {
    label: 'Umum',
    icon: '🏠',
    items: [
      { to: '/dashboard', label: 'Dashboard', tour: 'nav-dashboard' },
      { to: '/help', label: 'Bantuan / Panduan', tour: 'nav-help' },
    ],
  },
  {
    label: 'Master Data',
    icon: '🗂️',
    items: [
      { to: '/master/warehouses', label: 'Warehouses', tour: 'nav-master' },
      { to: '/master/product-categories', label: 'Product Categories' },
      { to: '/master/units', label: 'Units' },
      { to: '/master/products', label: 'Products' },
      { to: '/master/suppliers', label: 'Suppliers' },
      { to: '/master/customers', label: 'Customers' },
      { to: '/master/expeditions', label: 'Expeditions' },
    ],
  },
  {
    label: 'Purchase',
    icon: '🛒',
    items: [
      { to: '/purchase/orders', label: 'Purchase Orders', tour: 'nav-purchase' },
      { to: '/purchase/shipments', label: 'Shipments' },
      { to: '/purchase/receivings', label: 'Receivings' },
      { to: '/purchase/returns', label: 'Purchase Returns' },
    ],
  },
  {
    label: 'Sale',
    icon: '💰',
    items: [
      { to: '/sales/orders', label: 'Sale Orders', tour: 'nav-sale' },
      { to: '/sales/deliveries', label: 'Delivery Orders' },
      { to: '/sales/returns', label: 'Sale Returns' },
    ],
  },
  {
    label: 'Stock',
    icon: '📦',
    items: [
      { to: '/stock/overview', label: 'Stock Overview', tour: 'nav-stock' },
      { to: '/stock/transfers', label: 'Stock Transfers' },
      { to: '/stock/adjustments', label: 'Stock Adjustments' },
    ],
  },
  {
    label: 'Report',
    icon: '📊',
    items: [
      { to: '/reports', label: 'Reports', tour: 'nav-reports' },
      { to: '/jobs/dashboard', label: 'Scheduled Jobs', tour: 'nav-jobs' },
    ],
  },
  {
    label: 'Approval & Settings',
    icon: '⚙️',
    items: [
      { to: '/approval/workflows', label: 'Approval Workflows', tour: 'nav-approval' },
      { to: '/approval/inbox', label: 'Approval Inbox' },
      { to: '/notifications/rules', label: 'Notification Rules', tour: 'nav-notifications' },
      { to: '/settings/global-stock', label: 'Global Stock Settings', tour: 'nav-settings' },
      { to: '/settings/product-stock-settings', label: 'Product Stock Settings' },
    ],
  },
]

const route = useRoute()
const collapsedGroups = ref<Record<string, boolean>>({})
function toggleGroup(label: string) {
  collapsedGroups.value[label] = !collapsedGroups.value[label]
}
function isGroupActive(group: (typeof navGroups)[number]) {
  return group.items.some((item) => route.path.startsWith(item.to))
}

const sidebarOpen = ref(false)

const swal = useSwal()

async function handleLogout() {
  const confirmed = await swal.confirmLogout()
  if (!confirmed) return
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
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false" />
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <h2>IMS</h2>
      <nav>
        <div v-for="group in navGroups" :key="group.label" class="nav-group">
          <button
            class="nav-group-header"
            :class="{ active: isGroupActive(group) }"
            @click="toggleGroup(group.label)"
          >
            <span class="nav-group-icon">{{ group.icon }}</span>
            <span class="nav-group-label">{{ group.label }}</span>
            <span class="nav-group-chevron" :class="{ collapsed: collapsedGroups[group.label] }">▾</span>
          </button>
          <div v-show="!collapsedGroups[group.label]" class="nav-group-items">
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              :data-tour="item.tour"
              class="nav-link"
              @click="sidebarOpen = false"
            >
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>
      <div class="user-box" v-if="auth.user">
        <div>{{ auth.user.name }}</div>
        <button @click="handleLogout">Logout</button>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <button class="hamburger-btn" aria-label="Menu" @click="sidebarOpen = !sidebarOpen">☰</button>
        <div class="topbar-spacer" />
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
  width: 240px;
  flex-shrink: 0;
  background: #1e293b;
  color: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}
.sidebar h2 {
  margin: 0;
  padding: 0 8px;
}
.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: color 150ms ease-in-out;
}
.nav-group-header:hover,
.nav-group-header.active {
  color: #fff;
}
.nav-group-icon {
  font-size: 13px;
}
.nav-group-label {
  flex: 1;
  text-align: left;
}
.nav-group-chevron {
  transition: transform 150ms ease-in-out;
}
.nav-group-chevron.collapsed {
  transform: rotate(-90deg);
}
.nav-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
}
.nav-link {
  position: relative;
  color: #cbd5e1;
  text-decoration: none;
  padding: 8px 8px 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: background-color 150ms ease-in-out, color 150ms ease-in-out;
}
.nav-link:hover {
  background: #334155;
  color: #fff;
}
.nav-link.router-link-active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}
.nav-link.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 2px;
  background: var(--color-primary);
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
  min-width: 0;
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
.topbar-spacer {
  flex: 1;
}
.hamburger-btn {
  display: none;
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
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
  background: var(--color-bg);
}
.sidebar-overlay {
  display: none;
}

@media (max-width: 1024px) {
  .hamburger-btn {
    display: block;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 200ms ease-in-out;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    z-index: 150;
  }
}
</style>
