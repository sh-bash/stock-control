<script setup lang="ts">
const { startTour } = useTour()

const tab = ref<'mulai' | 'purchase' | 'sale' | 'stock' | 'approval' | 'dashboard' | 'admin'>('mulai')
</script>

<template>
  <div class="help-page">
    <div class="header-row">
      <h1>Bantuan / Panduan Penggunaan</h1>
      <button class="tour-cta" @click="startTour()">▶ Mulai Tour Interaktif</button>
    </div>
    <p class="lead">
      Panduan singkat cara pakai tiap modul. Untuk manual lengkap (termasuk daftar error dan bagian admin),
      lihat <code>docs/USER_GUIDE.md</code> di source code, atau dokumentasi API di
      <NuxtLink to="/docs/api">/docs/api</NuxtLink>.
    </p>

    <div class="tabs">
      <button :class="{ active: tab === 'mulai' }" @click="tab = 'mulai'">Mulai Cepat</button>
      <button :class="{ active: tab === 'purchase' }" @click="tab = 'purchase'">Purchase</button>
      <button :class="{ active: tab === 'sale' }" @click="tab = 'sale'">Sale</button>
      <button :class="{ active: tab === 'stock' }" @click="tab = 'stock'">Stock</button>
      <button :class="{ active: tab === 'approval' }" @click="tab = 'approval'">Approval &amp; Notifikasi</button>
      <button :class="{ active: tab === 'dashboard' }" @click="tab = 'dashboard'">Dashboard &amp; Reports</button>
      <button :class="{ active: tab === 'admin' }" @click="tab = 'admin'">Admin / Setup</button>
    </div>

    <!-- ============ MULAI CEPAT ============ -->
    <section v-if="tab === 'mulai'" class="card">
      <h2>Konsep Dasar</h2>
      <ul>
        <li><strong>FIFO wajib</strong> — semua stok keluar (penjualan, transfer, retur ke supplier, adjustment minus) selalu mengambil dari layer stok yang paling lama masuk lebih dulu. Ini otomatis, tidak perlu diatur manual.</li>
        <li><strong>Approval bersifat umum &amp; opsional per jenis dokumen</strong> — Purchase Order, Receiving, Purchase Return, dan Stock Adjustment melalui alur Submit → menunggu persetujuan → Approve/Reject. Sale Order, Delivery Order, Stock Transfer, dan Sale Return diproses langsung (satu tombol aksi), tidak melalui alur approval terpisah.</li>
        <li><strong>Semua user melihat menu yang sama</strong> — tidak ada menu yang disembunyikan per role. Role dipakai untuk menentukan siapa approver di Approval Workflow dan siapa penerima di Notification Rules.</li>
        <li><strong>Notifikasi</strong> muncul di lonceng (topbar) dan sebagai popup — popup dengan label bahaya (merah) tidak hilang otomatis, harus ditutup manual karena dianggap penting.</li>
      </ul>
      <h2>Urutan Belajar yang Disarankan</h2>
      <ol>
        <li>Lengkapi Master Data (Warehouse, Produk, Supplier/Customer) — lihat tab lain untuk detail tiap modul.</li>
        <li>Coba alur Purchase sampai stok masuk (lihat tab "Purchase").</li>
        <li>Coba alur Sale untuk mengeluarkan stok (lihat tab "Sale").</li>
        <li>Pantau semuanya lewat Dashboard dan Reports.</li>
      </ol>
    </section>

    <!-- ============ PURCHASE ============ -->
    <section v-if="tab === 'purchase'" class="card">
      <h2>Alur Pembelian</h2>
      <p>PO → Shipment → Receiving → (opsional) Purchase Return</p>
      <ol>
        <li>
          <strong>Purchase Order</strong> — buat PO dengan supplier, gudang tujuan, dan daftar produk+qty+harga.
          Status: <code>draft</code> → Submit → <code>waiting_approval</code> → Approve/Reject.
          <NuxtLink to="/purchase/orders">Buka Purchase Orders →</NuxtLink>
        </li>
        <li>
          <strong>Shipment</strong> — setelah PO approved, catat pengiriman dari ekspedisi: pilih PO yang mau dikirim,
          total biaya kirim, dan metode alokasi biaya (per qty / per nilai barang / per berat — pilih sesuai kondisi:
          "per qty" kalau semua barang sejenis, "per nilai" kalau barang campur murah-mahal, "per berat" kalau tarif ekspedisi berbasis berat).
          <NuxtLink to="/purchase/shipments">Buka Shipments →</NuxtLink>
        </li>
        <li>
          <strong>Receiving</strong> — catat barang benar-benar diterima di gudang. HPP dihitung otomatis (harga beli + biaya kirim per unit).
          Status: <code>draft</code> → Submit → <code>waiting_approval</code> → Approve/Reject. Setelah approved, stok bertambah (layer FIFO baru terbentuk).
          <NuxtLink to="/purchase/receivings">Buka Receivings →</NuxtLink>
        </li>
        <li>
          <strong>Purchase Return</strong> — kembalikan sebagian/semua barang dari sebuah Receiving yang sudah approved ke supplier.
          Mengurangi qty dari layer stok spesifik hasil receiving itu.
          <NuxtLink to="/purchase/returns">Buka Purchase Returns →</NuxtLink>
        </li>
      </ol>
    </section>

    <!-- ============ SALE ============ -->
    <section v-if="tab === 'sale'" class="card">
      <h2>Alur Penjualan</h2>
      <p><strong>Pilihan paling penting:</strong> saat membuat Sale Order, ada centang <code>use_do</code> (pakai Delivery Order terpisah).</p>
      <table class="compare-table">
        <thead><tr><th></th><th>use_do = tidak dicentang</th><th>use_do = dicentang</th></tr></thead>
        <tbody>
          <tr><td>Saat Confirm SO</td><td>Stok langsung berkurang (FIFO), transaksi selesai</td><td>Stok hanya "direservasi" (belum keluar fisik)</td></tr>
          <tr><td>Butuh langkah lanjutan?</td><td>Tidak</td><td>Ya — buat &amp; approve Delivery Order</td></tr>
          <tr><td>Kapan HPP/biaya pokok dihitung?</td><td>Saat Confirm SO</td><td>Saat Delivery Order di-approve</td></tr>
          <tr><td>Cocok untuk</td><td>Penjualan langsung/tunai, barang langsung diambil</td><td>Pesanan dikirim bertahap, atau ada jeda antara pesan dan kirim</td></tr>
        </tbody>
      </table>
      <p class="note">Pilihan ini tidak bisa diubah setelah SO dibuat — pastikan pilih sesuai proses bisnis sebelum Confirm.</p>
      <ol>
        <li><strong>Sale Order</strong> — pilih customer, gudang, centang <code>use_do</code> sesuai kebutuhan, isi produk+qty+harga jual, lalu <em>Confirm</em>. <NuxtLink to="/sales/orders">Buka Sale Orders →</NuxtLink></li>
        <li><strong>Delivery Order</strong> — hanya untuk SO dengan use_do=ya. Pilih SO, isi qty yang benar-benar dikirim, lalu <em>Approve</em> — ini yang memicu stok keluar. <NuxtLink to="/sales/deliveries">Buka Delivery Orders →</NuxtLink></li>
        <li><strong>Sale Return</strong> — retur dari SO (use_do=tidak) atau DO (use_do=ya). Kondisi "Baik" akan mengembalikan barang ke stok (pakai HPP asli saat keluar); kondisi "Rusak" hanya dicatat, tidak menambah stok. <NuxtLink to="/sales/returns">Buka Sale Returns →</NuxtLink></li>
      </ol>
    </section>

    <!-- ============ STOCK ============ -->
    <section v-if="tab === 'stock'" class="card">
      <h2>Modul Stock</h2>
      <ul>
        <li>
          <strong>Stock Overview</strong> — 3 tab: <em>Summary</em> (qty di tangan/direservasi/tersedia/nilai per produk+gudang),
          <em>Layers</em> (rincian FIFO per batch masuk, urut dari yang paling lama), <em>Ledger</em> (kartu mutasi semua transaksi).
          Ada tombol <strong>"Rebuild Stock Summary"</strong> untuk menghitung ulang ringkasan dari data layer/ledger — pakai ini
          kalau ada kecurigaan angka summary tidak sinkron (mis. setelah insiden/bug, bukan operasi rutin harian).
          <NuxtLink to="/stock/overview">Buka Stock Overview →</NuxtLink>
        </li>
        <li>
          <strong>Stock Transfer</strong> — pindahkan stok antar gudang. Pilih layer spesifik yang mau dipindah (bukan asal ambil),
          jadi Anda bisa lihat dulu umur &amp; HPP tiap layer sebelum memilih.
          <NuxtLink to="/stock/transfers">Buka Stock Transfers →</NuxtLink>
        </li>
        <li>
          <strong>Stock Adjustment</strong> — koreksi manual (opname, barang hilang/rusak, dsb). Qty diff positif (menambah) wajib isi HPP manual;
          qty diff negatif (mengurangi) otomatis ambil dari FIFO, tidak perlu isi HPP.
          Status: <code>draft</code> → Submit → <code>waiting_approval</code> → Approve/Reject.
          <NuxtLink to="/stock/adjustments">Buka Stock Adjustments →</NuxtLink>
        </li>
      </ul>
    </section>

    <!-- ============ APPROVAL & NOTIFIKASI ============ -->
    <section v-if="tab === 'approval'" class="card">
      <h2>Approval Inbox</h2>
      <p>
        Dokumen yang menunggu persetujuan Anda (sesuai role/user yang terdaftar sebagai approver di step aktif) muncul di
        <NuxtLink to="/approval/inbox">Approval Inbox</NuxtLink>. Klik Approve atau Reject (boleh tambah catatan).
        Ingat: hanya PO, Receiving, Purchase Return, dan Stock Adjustment yang lewat alur ini — SO/DO/Transfer/Sale Return
        diproses langsung dari halamannya masing-masing.
      </p>
      <h2>Notifikasi</h2>
      <ul>
        <li>Ikon lonceng di kanan atas menyimpan riwayat notifikasi Anda; klik untuk menandai sudah dibaca.</li>
        <li>Popup muncul otomatis (realtime) saat ada kejadian yang relevan untuk Anda.</li>
        <li>Warna severity: <span class="dot" style="background:#dc2626"></span> merah = bahaya (tidak hilang otomatis, harus ditutup manual),
          <span class="dot" style="background:#ea580c"></span> oranye = peringatan, <span class="dot" style="background:#2563eb"></span> biru = info.</li>
      </ul>
      <p class="note">Siapa yang menerima notifikasi apa diatur oleh Admin di menu Notification Rules (lihat tab "Admin / Setup").</p>
    </section>

    <!-- ============ DASHBOARD & REPORTS ============ -->
    <section v-if="tab === 'dashboard'" class="card">
      <h2>Dashboard</h2>
      <ul>
        <li><strong>Stock Value Overview</strong> — total nilai &amp; qty stok, per gudang.</li>
        <li><strong>Aging Summary</strong> — sebaran umur stok (donut chart): 0-30, 31-60, 61-90, 90+ hari.</li>
        <li><strong>Movement Classification</strong> — jumlah produk per kategori pergerakan: fast/normal/slow/dead.</li>
        <li><strong>Purchase vs Sale Trend</strong> — grafik garis nilai pembelian vs penjualan per hari.</li>
        <li><strong>Pending Approvals</strong> — dokumen yang menunggu persetujuan Anda (ringkasan dari Approval Inbox).</li>
        <li><strong>Low Stock Alert</strong> — produk yang sudah di/bawah titik reorder atau stok minimum.</li>
      </ul>
      <p>
        Detail per produk (kapan diperkirakan stok habis) ada di
        <NuxtLink to="/dashboard/stock-aging-projection">Stock Aging &amp; Projection →</NuxtLink>.
      </p>
      <h2>Reports</h2>
      <p>4 tab laporan, semua bisa difilter periode/gudang/produk: <strong>Purchase</strong> (PO outstanding + riwayat harga),
        <strong>Sale</strong> (revenue/COGS/margin), <strong>Inventory Valuation</strong> (butuh job harian sudah pernah jalan minimal sekali),
        dan <strong>Mutation/Kartu Stok</strong> (riwayat keluar-masuk per produk).
        <NuxtLink to="/reports">Buka Reports →</NuxtLink>
      </p>
    </section>

    <!-- ============ ADMIN / SETUP ============ -->
    <section v-if="tab === 'admin'" class="card">
      <h2>Global &amp; Product Stock Settings</h2>
      <p>
        <NuxtLink to="/settings/global-stock">Global Stock Settings</NuxtLink> berlaku untuk semua produk secara default.
        <NuxtLink to="/settings/product-stock-settings">Product Stock Settings</NuxtLink> membuat pengecualian per produk
        (opsional per produk+gudang tertentu) — field yang dikosongkan tetap mengikuti nilai global.
      </p>
      <h2>Approval Workflows</h2>
      <p>
        Di <NuxtLink to="/approval/workflows">Approval Workflows</NuxtLink>, buat alur per jenis dokumen: tentukan urutan step,
        dan siapa approver tiap step (role atau user tertentu).
      </p>
      <p class="note">
        ⚠️ Saat ini hanya PO, Receiving, Purchase Return, dan Stock Adjustment yang benar-benar memicu approval instance dari
        halaman transaksinya. Membuat workflow untuk jenis dokumen Sale Order/Delivery Order/Stock Transfer/Sale Return tidak
        akan pernah terpakai — dokumen-dokumen itu diproses langsung tanpa approval, ini keputusan desain, bukan bug.
      </p>
      <h2>Notification Rules</h2>
      <p>
        Di <NuxtLink to="/notifications/rules">Notification Rules</NuxtLink>, buat aturan: jenis kejadian (stok minimum,
        reorder point, aging, dsb), cakupan (semua produk / kategori tertentu / produk tertentu / gudang tertentu), dan target
        penerima (role dan/atau user tertentu). Jika beberapa aturan cocok untuk kejadian yang sama, penerimanya digabung
        (bukan saling menimpa) — makin banyak aturan yang cocok, makin banyak yang menerima notifikasi.
      </p>
      <h2>Scheduled Jobs</h2>
      <p>
        Job otomatis berjalan sesuai jadwal (klasifikasi movement &amp; cek aging setiap hari, snapshot valuasi setiap hari,
        rekonsiliasi stok setiap minggu). Riwayat &amp; hasil bisa dilihat serta dipicu manual di
        <NuxtLink to="/jobs/dashboard">Scheduled Jobs →</NuxtLink> (untuk keperluan testing atau backfill).
      </p>
    </section>
  </div>
</template>

<style scoped>
.help-page { max-width: 900px; }
.header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
h1 { margin: 0; }
.tour-cta { padding: 10px 16px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; font-weight: 600; }
.lead { color: #64748b; font-size: 14px; margin-bottom: 16px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.tabs button { padding: 8px 14px; border: none; border-radius: 6px; background: #e2e8f0; color: #334155; cursor: pointer; }
.tabs button.active { background: #2563eb; color: #fff; }
.card { background: #fff; padding: 20px 24px; border-radius: 8px; }
.card h2 { font-size: 16px; margin: 20px 0 8px; }
.card h2:first-child { margin-top: 0; }
.card ul, .card ol { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
.card a { color: #2563eb; }
.note { font-size: 13px; color: #64748b; background: #f1f5f9; padding: 10px 12px; border-radius: 6px; }
.compare-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
.compare-table th, .compare-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.compare-table th { background: #f8fafc; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 2px; }
</style>
