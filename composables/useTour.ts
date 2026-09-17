// In-app guided tour of the sidebar navigation, built on driver.js.
// Deliberately a single-page tour anchored on /dashboard (the sidebar is
// present on every page, so one orientation pass there covers navigation
// for the whole app) instead of a fragile multi-page driver.js sequence.
// Callable from anywhere (topbar "?" button, /help page, first-login
// auto-trigger) via startTour(); if the caller isn't already on /dashboard
// it navigates there first and waits for the layout to settle.

const TOUR_SEEN_KEY = 'ims_tour_seen_v1'

function safeLocalStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function buildSteps(): import('driver.js').DriveStep[] {
  return [
    {
      element: '[data-tour="nav-dashboard"]',
      popover: {
        title: 'Dashboard',
        description: 'Ringkasan stok, grafik aging & movement, alert stok rendah, dan tren pembelian vs penjualan. Titik awal yang baik setiap kali login.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-help"]',
      popover: {
        title: 'Bantuan / Panduan',
        description: 'Panduan lengkap cara pakai tiap modul ada di sini, kapan saja bisa dibuka ulang. Tombol "Mulai Tour" di halaman ini juga bisa memutar ulang tour ini.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-master"]',
      popover: {
        title: 'Master Data',
        description: 'Warehouses, Kategori Produk, Unit, Produk, Supplier, Customer, Ekspedisi — data dasar yang dipakai di seluruh modul lain. Semua halaman ini punya pola yang sama: form tambah/edit di atas, tabel di bawah.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-settings"]',
      popover: {
        title: 'Settings',
        description: 'Ambang batas stok minimum/reorder secara global, dan override per produk (atau per produk+gudang) bila perlu berbeda dari nilai global.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-purchase"]',
      popover: {
        title: 'Purchase',
        description: 'Alur pembelian: Purchase Order → Shipment (alokasi biaya kirim) → Receiving (stok masuk, HPP dihitung otomatis) → Purchase Return.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-sale"]',
      popover: {
        title: 'Sale',
        description: 'Alur penjualan: Sale Order (pilih apakah pakai Delivery Order terpisah atau langsung) → Delivery Order → Sale Return.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-stock"]',
      popover: {
        title: 'Stock',
        description: 'Stock Overview (ringkasan, kartu FIFO per layer, kartu mutasi/ledger), Stock Transfer antar gudang, dan Stock Adjustment untuk koreksi manual.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-jobs"]',
      popover: {
        title: 'Scheduled Jobs',
        description: 'Job otomatis harian/mingguan (klasifikasi movement, cek aging, snapshot valuasi, rekonsiliasi stok) dan riwayat eksekusinya.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-reports"]',
      popover: {
        title: 'Reports',
        description: 'Laporan Purchase, Sale, Valuasi Inventori, dan Kartu Stok (mutasi) — semuanya dengan filter periode/gudang/produk.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-approval"]',
      popover: {
        title: 'Approval',
        description: 'Atur alur persetujuan per jenis dokumen (siapa approve, berapa step), dan Approval Inbox untuk memproses dokumen yang menunggu persetujuan Anda.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-notifications"]',
      popover: {
        title: 'Notification Rules',
        description: 'Atur siapa yang menerima notifikasi untuk kondisi tertentu (stok minimum, aging, dll) — bisa berdasarkan role, produk, kategori, atau gudang.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="topbar-help"]',
      popover: {
        title: 'Ulangi tour ini kapan saja',
        description: 'Klik tombol ini dari halaman manapun untuk memutar ulang tour ini. Panduan lengkap tertulis tetap ada di menu "Bantuan / Panduan".',
        side: 'bottom',
      },
    },
  ]
}

export function useTour() {
  async function startTour() {
    if (!import.meta.client) return

    const route = useRoute()
    if (route.path !== '/dashboard') {
      await navigateTo('/dashboard')
      await nextTick()
      // Let the dashboard's own onMounted data fetch/render settle before
      // driver.js measures element positions.
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    const { driver } = await import('driver.js')
    const tourInstance = driver({
      showProgress: true,
      allowClose: true,
      nextBtnText: 'Lanjut',
      prevBtnText: 'Kembali',
      doneBtnText: 'Selesai',
      steps: buildSteps(),
    })
    tourInstance.drive()
  }

  function hasSeenTour() {
    return safeLocalStorage()?.getItem(TOUR_SEEN_KEY) === '1'
  }

  function markTourSeen() {
    try {
      safeLocalStorage()?.setItem(TOUR_SEEN_KEY, '1')
    } catch {
      // ignore — worst case the auto-tour just replays next visit
    }
  }

  return { startTour, hasSeenTour, markTourSeen }
}
