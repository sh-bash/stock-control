# User Guide — Inventory Management System (stock_control)

Panduan penggunaan untuk staff operasional dan admin. Untuk spesifikasi teknis lengkap lihat [`docs/PRD.md`](PRD.md); untuk referensi API (integrasi/mobile client) lihat `/docs/api` di aplikasi. Panduan versi ringkas juga tersedia langsung di dalam aplikasi pada menu **Bantuan / Panduan** (`/help`), lengkap dengan tombol untuk memutar ulang tour interaktif kapan saja.

## Daftar Isi

1. [Pendahuluan](#1-pendahuluan)
2. [Login & Navigasi](#2-login--navigasi)
3. [Bagian Operasional Harian](#3-bagian-operasional-harian)
4. [Bagian Admin / Konfigurasi](#4-bagian-admin--konfigurasi)
5. [Troubleshooting / Error Umum](#5-troubleshooting--error-umum)
6. [Referensi](#6-referensi)

---

## 1. Pendahuluan

Sistem ini mengelola alur inventori dari pembelian sampai penjualan, dengan pelacakan stok berbasis FIFO (First In First Out) dan pencatatan biaya pokok (HPP) otomatis. Tiga konsep dasar yang perlu dipahami sebelum memakai modul manapun:

- **FIFO wajib dan otomatis.** Setiap stok keluar (penjualan, transfer, retur ke supplier, adjustment pengurangan) selalu diambil dari batch (layer) stok yang paling lama masuk lebih dulu. Anda tidak perlu — dan tidak bisa — memilih batch mana yang dipakai untuk penjualan; sistem yang menentukan secara otomatis berdasarkan tanggal terima.
- **Approval bersifat umum, tapi hanya dipakai di sebagian dokumen.** Ada mesin approval generik yang bisa dikonfigurasi untuk jenis dokumen apapun (menu Approval Workflows), tapi di aplikasi saat ini hanya **Purchase Order, Receiving, Purchase Return, dan Stock Adjustment** yang benar-benar memicu alur submit → menunggu approval → approve/reject dari halaman transaksinya. **Sale Order, Delivery Order, Stock Transfer, dan Sale Return** diproses langsung dengan satu tombol aksi (Confirm/Approve/Buat), tanpa melalui approval terpisah — ini keputusan desain yang disengaja, bukan kekurangan.
- **Semua user melihat menu yang sama.** Tidak ada pembatasan menu berdasarkan role/jabatan — siapapun yang login bisa membuka semua halaman. Role dipakai di dua tempat saja: menentukan siapa approver di suatu step Approval Workflow, dan siapa target penerima di suatu Notification Rule.

---

## 2. Login & Navigasi

- Buka aplikasi, masuk dengan email & password yang diberikan admin. Setelah berhasil, Anda diarahkan ke **Dashboard**.
- **Sidebar kiri** berisi seluruh menu, dikelompokkan (dari atas): Dashboard, Bantuan, Master Data (Warehouses s/d Expeditions), Settings, Purchase (Orders s/d Returns), Sale (Orders s/d Returns), Stock (Overview s/d Adjustments), Scheduled Jobs, Reports, Approval (Workflows & Inbox), Notification Rules.
- **Topbar kanan atas**: tombol **"?"** (memutar ulang tour interaktif kapan saja, dari halaman manapun) dan **ikon lonceng notifikasi** (riwayat notifikasi Anda, dengan badge jumlah belum dibaca).
- **Toast/popup** notifikasi realtime muncul di kanan atas layar saat ada kejadian relevan — popup severity "bahaya" (merah) tidak hilang otomatis dan harus ditutup manual dengan tombol ×; popup lain hilang otomatis setelah beberapa detik.
- **Tour interaktif**: muncul otomatis satu kali saat pertama kali login (highlight tiap kelompok menu di sidebar). Bisa diputar ulang kapan saja lewat tombol "?" di topbar, atau tombol "▶ Mulai Tour Interaktif" di halaman `/help`.

---

## 3. Bagian Operasional Harian

### 3.1 Master Data

Tujuh halaman (`Warehouses`, `Product Categories`, `Units`, `Products`, `Suppliers`, `Customers`, `Expeditions`) memakai pola yang identik:

- Form tambah/edit di bagian atas halaman.
- Tabel data di bawahnya, dengan tombol **Edit** dan **Hapus** per baris.
- Field bertanda wajib harus diisi; field lain opsional.
- Menghapus data akan meminta konfirmasi (dialog browser).

Isi Master Data ini terlebih dahulu sebelum mencoba transaksi Purchase/Sale, karena semua dokumen transaksi merujuk ke data ini (produk, gudang, supplier, customer, ekspedisi).

Catatan khusus:
- **Products**: field `category_id`/`base_unit_id` diisi dengan ID (bukan dropdown nama) — lihat ID kategori/unit dari halaman masing-masing.
- **Expeditions**: punya field `default_allocation_method` (per_qty/per_value/per_weight) — dipakai sebagai referensi saat membuat Shipment, tapi Shipment tetap bisa memilih metode alokasi lain saat dibuat.

### 3.2 Alur Purchase (Pembelian)

Urutan dokumen: **Purchase Order → Shipment → Receiving → (opsional) Purchase Return**

#### a. Purchase Order (`/purchase/orders`)
1. Klik buat baru: pilih Supplier, Warehouse tujuan, Order Date, lalu tambahkan baris item (Produk, Qty, Harga Satuan) — bisa lebih dari satu baris.
2. Status berjalan: `draft` → tombol **Submit** → `waiting_approval` → tombol **Approve**/**Reject** (oleh approver sesuai Approval Workflow untuk `po`) → `approved` atau `rejected`.
3. Setelah `approved`, PO siap dijadikan Shipment/Receiving. Status akan berubah otomatis menjadi `partial_received` lalu `closed` seiring qty diterima bertambah.

#### b. Shipment (`/purchase/shipments`)
1. Pilih Ekspedisi, Ship Date, Total Biaya Kirim, dan **Metode Alokasi Biaya**:
   - **Per Qty** — biaya kirim dibagi rata per unit barang. Cocok jika semua barang dalam pengiriman sejenis/nilainya mirip.
   - **Per Value** — biaya kirim dibagi proporsional terhadap nilai barang (qty × harga beli). Cocok jika barang campuran murah dan mahal dalam satu pengiriman.
   - **Per Weight** — biaya kirim dibagi proporsional terhadap berat. Cocok jika tarif ekspedisi dihitung berdasarkan berat, dan isi kolom Berat per item.
2. Centang satu atau lebih PO yang sudah `approved`/`partial_received` — baris item akan otomatis terisi dari sisa qty PO tersebut.
3. Biaya kirim per unit untuk tiap item dihitung otomatis oleh sistem sesuai metode yang dipilih (bisa dilihat di detail baris setelah shipment dibuat).

#### c. Receiving (`/purchase/receivings`)
1. Pilih Shipment yang barangnya sudah tiba fisik, pilih Warehouse penerima dan Receive Date.
2. Konfirmasi Qty Received per item (bisa berbeda dari qty yang dikirim bila ada kekurangan).
3. Status: `draft` → **Submit** → `waiting_approval` → **Approve**/**Reject**.
4. Setelah `approved`: HPP dihitung otomatis (**Harga Beli + Biaya Kirim per Unit**), layer stok FIFO baru terbentuk, dan `qty_on_hand` di gudang bertambah.

#### d. Purchase Return (`/purchase/returns`)
1. Pilih Receiving yang statusnya sudah `approved`.
2. Pilih qty yang mau dikembalikan per produk (mengacu ke layer stok spesifik dari Receiving tersebut, bukan FIFO umum), isi alasan retur.
3. Status: `draft` → **Submit** → `waiting_approval` → **Approve**/**Reject**. Setelah approved, qty layer terkait berkurang.

### 3.3 Alur Sale (Penjualan)

Urutan dokumen: **Sale Order → (opsional) Delivery Order → (opsional) Sale Return**

**Konsep paling penting**: saat membuat Sale Order, ada checkbox **`use_do`** yang menentukan alurnya:

| | `use_do` tidak dicentang | `use_do` dicentang |
|---|---|---|
| Saat tombol **Confirm** ditekan | Stok langsung berkurang (FIFO), transaksi selesai (`closed`) | Stok hanya **direservasi** (`qty_reserved` bertambah), belum keluar fisik |
| Langkah lanjutan? | Tidak ada | Wajib buat & approve **Delivery Order** |
| Kapan HPP dihitung? | Saat Confirm | Saat Delivery Order di-approve |
| Contoh pemakaian | Penjualan tunai/langsung, barang diambil di tempat saat itu juga | Pesanan yang dikirim belakangan atau bertahap (partial delivery) |

Pilihan `use_do` **tidak bisa diubah setelah SO dibuat** — pastikan sudah sesuai sebelum menekan Confirm.

#### a. Sale Order (`/sales/orders`)
1. Pilih Customer, Warehouse, Order Date, centang `use_do` sesuai kebutuhan, isi baris item (Produk, Qty, Harga Jual).
2. Tekan **Confirm** — efeknya sesuai tabel di atas.

#### b. Delivery Order (`/sales/deliveries`) — hanya untuk SO dengan `use_do` dicentang
1. Pilih SO yang berstatus `confirmed`/`partial_delivered` — baris item akan terisi sisa qty yang belum dikirim.
2. Isi Qty Delivered aktual (boleh sebagian, untuk pengiriman bertahap), isi Delivery Date.
3. Status: `draft` → tombol **Approve**. Saat approve, ini yang benar-benar memicu konsumsi stok FIFO dan menghitung `cogs_per_unit`; `qty_reserved` di SO berkurang dan `qty_delivered` SO bertambah.

#### c. Sale Return (`/sales/returns`)
1. Pilih Source Type: **DO** (harus sudah `approved`) atau **SO** (harus `closed`/`partial_delivered`, untuk kasus `use_do`=tidak).
2. Pilih **Kondisi**:
   - **Baik** — barang direstock ke stok (layer baru dibuat memakai HPP yang sama saat barang itu keluar dulu, bukan HPP rata-rata terkini).
   - **Rusak** — hanya dicatat sebagai riwayat, tidak menambah stok yang bisa dijual lagi.
3. Tekan tombol "Buat & Proses" — retur langsung diproses (tidak ada tahap approval terpisah).

### 3.4 Modul Stock

#### a. Stock Overview (`/stock/overview`)
Tiga tab:
- **Summary** — `qty_on_hand` (fisik), `qty_reserved` (dipesan tapi belum keluar), `qty_available` (bisa dijual = on_hand − reserved), dan `total_value` per kombinasi produk+gudang.
- **Layers** — rincian tiap batch stok FIFO: qty asli, qty sisa, HPP per unit, tanggal terima, status (`active`/`exhausted`), diurutkan dari yang paling lama.
- **Ledger** — kartu mutasi mentah, semua transaksi (masuk/keluar) dengan saldo berjalan, diurutkan terbaru dulu.

Tombol **"Rebuild Stock Summary"** menghitung ulang tabel Summary dari data Layers/Ledger yang sebenarnya. Ini bukan operasi rutin harian — pakai hanya bila ada kecurigaan angka Summary tidak sinkron (misalnya setelah insiden teknis), karena sistem sudah menjaga konsistensi otomatis di setiap transaksi normal.

#### b. Stock Transfer (`/stock/transfers`)
Pindahkan stok antar gudang: pilih Gudang Asal & Tujuan, Transfer Date, lalu untuk tiap item **pilih layer spesifik** yang mau dipindah (bukan asal ambil FIFO otomatis) — jadi Anda bisa melihat dulu umur dan HPP tiap layer sebelum memutuskan. Diproses langsung tanpa approval.

#### c. Stock Adjustment (`/stock/adjustments`)
Untuk koreksi manual (hasil opname, barang hilang/rusak, dsb): pilih Warehouse, isi Reason, dan baris item dengan **Qty Diff**:
- Qty Diff **positif** (menambah stok) — wajib isi HPP manual (nilai per unit barang yang ditambahkan).
- Qty Diff **negatif** (mengurangi stok) — HPP tidak perlu diisi, sistem otomatis mengambil dari FIFO.

Status: `draft` → **Submit** → `waiting_approval` → **Approve**/**Reject**.

### 3.5 Approval Inbox (`/approval/inbox`)

Menampilkan semua dokumen yang statusnya `waiting_approval`/`pending` dan Anda terdaftar sebagai approver (baik langsung sebagai user, atau lewat role Anda) di step aktifnya. Tekan **Approve** atau **Reject**, boleh disertai catatan. Widget "Pending Approvals" di Dashboard adalah ringkasan cepat dari halaman ini.

### 3.6 Notifikasi

- **Lonceng** di topbar: klik untuk membuka daftar notifikasi Anda; klik satu notifikasi untuk menandainya sudah dibaca.
- **Popup (toast)** muncul realtime di kanan atas layar. Warna severity: merah = bahaya (persisten, harus ditutup manual), oranye = peringatan, biru = info.
- Siapa yang menerima notifikasi apa diatur oleh admin (lihat §4.3).

### 3.7 Dashboard (`/dashboard`)

Widget yang tersedia (filter Gudang di kanan atas mempengaruhi semua widget):
- **Stock Value Overview** — total nilai & qty stok saat ini, dengan rincian per gudang.
- **Aging Summary** (donut chart) — sebaran umur batch stok yang masih aktif: 0-30, 31-60, 61-90, 90+ hari.
- **Movement Classification** (bar chart) — jumlah produk per kategori pergerakan (fast/normal/slow/dead), dihitung dari job harian.
- **Purchase vs Sale Trend** (line chart) — nilai pembelian vs penjualan per hari, 30 hari terakhir secara default.
- **Pending Approvals** — dokumen yang menunggu approval Anda.
- **Low Stock Alert** — produk yang sudah menyentuh/di bawah reorder point (peringatan) atau stok minimum (bahaya).

Halaman detail **Stock Aging & Projection** (link di bawah Dashboard) menampilkan, per produk: umur layer stok tertua, rata-rata qty keluar per hari (30 hari), dan proyeksi kapan stok akan habis berdasarkan rata-rata itu (produk tanpa pergerakan/dead stock ditandai "tidak ada proyeksi").

### 3.8 Reports (`/reports`)

Empat tab, semua punya filter periode/gudang/produk/kategori:
- **Purchase** — daftar PO yang masih outstanding (qty belum diterima penuh) + riwayat harga beli per produk.
- **Sale** — ringkasan Revenue/COGS/Margin + rincian per baris transaksi (dari SO langsung maupun dari DO).
- **Inventory Valuation** — nilai stok per tanggal, diambil dari snapshot harian (job `stock-valuation-snapshot`). Jika belum pernah ada job yang jalan, laporan ini akan kosong dengan pesan yang menjelaskan hal itu.
- **Mutation (Kartu Stok)** — wajib pilih satu Produk; menampilkan saldo awal, semua mutasi dalam periode, dan saldo akhir.

---

## 4. Bagian Admin / Konfigurasi

### 4.1 Global Stock Settings & Product Stock Settings

- **`/settings/global-stock`** — satu set nilai default yang berlaku untuk **semua** produk: batas stok minimum, reorder point, reorder qty, ambang fast/slow moving (qty keluar per hari), dan ambang hari aging (peringatan/bahaya).
- **`/settings/product-stock-settings`** — override per produk (opsional dipersempit lagi ke produk+gudang tertentu). **Field yang dikosongkan tetap mengikuti nilai Global** — override berlaku per-field, bukan per-baris, jadi Anda bisa hanya meng-override `min_stock` untuk satu produk sementara field lain tetap ikut Global.

### 4.2 Approval Workflows (`/approval/workflows`)

1. Pilih **Document Type** (`po`, `receiving`, `purchase_return`, `so`, `do`, `adjustment`, `transfer`, `sale_return`) dan beri Nama workflow.
2. Tambahkan **Step** secara berurutan: tiap step punya satu approver (tipe `role` atau `user` spesifik, isi ID-nya).
3. Workflow bisa dinonaktifkan (tidak dihapus) lewat toggle Active.

> ⚠️ **Penting**: hanya `po`, `receiving`, `purchase_return`, dan `adjustment` yang benar-benar memicu approval instance dari halaman transaksinya saat ini. Membuat workflow untuk `so`/`do`/`transfer`/`sale_return` tidak akan pernah ter-trigger — dokumen jenis itu diproses langsung dari halamannya masing-masing (lihat §1 dan §3.3). Ini keputusan desain awal (Fase 6), bukan bug yang belum sempat diperbaiki — jangan menghabiskan waktu mengonfigurasi approval untuk jenis dokumen ini.

Untuk menguji sebuah workflow tanpa membuat transaksi sungguhan, halaman **Approval Inbox** punya tombol "Submit Dokumen Dummy" yang membuat instance approval percobaan.

### 4.3 Notification Rules (`/notifications/rules`)

1. Buat rule: pilih **Type** (kejadian yang memicu, mis. `min_stock`, `reorder_point`, `aging_warning`, `aging_danger`, `slow_moving`, `dead_stock`, `approval_pending`), dan **Scope** (`global` = semua produk, atau dipersempit ke `category`/`product`/`warehouse`/`product_warehouse` — isi `scope_id` sesuai).
2. Tambahkan satu atau lebih **Target** per rule: `role` (semua user dengan role itu) atau `user` (satu user spesifik).
3. **Penting — perilaku union/additive**: jika beberapa rule cocok untuk kejadian yang sama (misalnya rule global + rule khusus kategori tertentu, sama-sama match), maka **gabungan** semua target dari rule-rule itu yang menerima notifikasi — bukan rule yang lebih spesifik "menimpa" yang lebih umum. Semakin banyak rule yang cocok, semakin banyak penerima.

### 4.4 Scheduled Jobs (`/jobs/dashboard`)

Empat job berjalan otomatis sesuai jadwal berikut (lihat `nuxt.config.ts`):

| Job | Jadwal | Fungsi |
|---|---|---|
| `stock-valuation-snapshot` | Harian 00:30 | Menyimpan snapshot nilai stok hari itu (dipakai laporan Inventory Valuation) |
| `movement-classification` | Harian 01:00 | Menghitung rata-rata qty keluar 30/90 hari, mengklasifikasi tiap produk+gudang: fast/normal/slow/dead |
| `aging-check` | Harian 01:00 | Mengecek umur tiap layer stok aktif, mengirim notifikasi peringatan/bahaya bila melewati ambang aging |
| `stock-reconciliation` | Mingguan, Minggu 02:00 | Membandingkan Stock Summary vs jumlah aktual di Stock Layers, mencatat selisih (read-only, tidak memperbaiki otomatis — gunakan tombol "Rebuild Stock Summary" di Stock Overview bila perlu perbaikan) |

Halaman ini juga menampilkan **riwayat eksekusi** tiap job (sukses/gagal, jumlah baris diproses, durasi) dan tombol untuk **menjalankan manual** (`movement-classification`, `aging-check`, `stock-reconciliation`) — berguna untuk testing atau backfill data, tidak perlu menunggu jadwal cron.

---

## 5. Troubleshooting / Error Umum

| Pesan / Kode Error | Artinya | Yang harus dilakukan |
|---|---|---|
| `INSUFFICIENT_STOCK` | Qty yang diminta (jual/transfer/keluar) melebihi stok yang tersedia di gudang tersebut | Kurangi qty, atau cek Stock Overview dulu untuk lihat sisa stok riil |
| `INSUFFICIENT_RESERVED` | Mencoba melepas reservasi (`qty_reserved`) lebih besar dari yang sedang direservasi | Biasanya terjadi karena DO parsial ganda — cek qty yang sudah dikirim sebelumnya di SO terkait |
| `DUPLICATE_SETTING` | Sudah ada Product Stock Settings aktif untuk kombinasi produk (+gudang) yang sama | Edit setting yang sudah ada, atau nonaktifkan dulu yang lama sebelum membuat yang baru |
| `INVALID_ALLOCATION_METHOD` | Metode alokasi biaya kirim di Shipment tidak dikenali | Pastikan memilih salah satu dari per_qty/per_value/per_weight |
| `EMPTY_PO_REF` | Membuat Shipment tanpa mencentang PO manapun | Centang minimal satu PO sebelum menyimpan |
| `NOT_FOUND` | Dokumen/data yang direferensikan tidak ditemukan (mungkin ID salah, atau sudah dihapus) | Periksa kembali dokumen yang dipilih |
| Halaman Inventory Valuation kosong dengan pesan "Belum ada snapshot" | Job `stock-valuation-snapshot` belum pernah jalan | Tunggu jadwal otomatis (00:30) atau minta admin trigger manual dari halaman terkait |

Untuk error lain yang tidak tercantum, catat pesan errornya (biasanya muncul di bagian atas form berwarna merah) dan sampaikan ke admin/developer sistem.

---

## 6. Referensi

- **Panduan versi ringkas di dalam aplikasi**: menu **Bantuan / Panduan** (`/help`) — juga tempat memutar ulang tour interaktif.
- **Dokumentasi API (Swagger)**: `/docs/api` di aplikasi — untuk kebutuhan integrasi atau pengembangan mobile client.
- **Spesifikasi teknis lengkap**: [`docs/PRD.md`](PRD.md) — untuk developer, mencakup skema database dan detail logika bisnis tiap fungsi inti.
