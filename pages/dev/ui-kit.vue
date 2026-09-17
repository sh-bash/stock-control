<script setup lang="ts">
// Internal QA page only — showcases every components/base/* component with
// dummy data so the base UI kit can be reviewed before any real page gets
// refactored to use it. Not linked from the sidebar; reachable directly at
// /dev/ui-kit.
definePageMeta({ layout: 'default' })

// --- Button demo ---
const btnLoading = ref(false)
function simulateSubmit() {
  btnLoading.value = true
  setTimeout(() => (btnLoading.value = false), 1500)
}

// --- Badge demo ---
const statuses = ['draft', 'waiting_approval', 'approved', 'rejected', 'closed', 'partial_received', 'active', 'exhausted', 'good', 'damaged', 'fast', 'normal', 'slow', 'dead']

// --- Form demo ---
const form = ref({
  name: '',
  category: '',
  note: '',
  qty: null as number | null,
  qtyDiff: null as number | null,
  date: '',
})
const formErrors = ref({ name: '', qty: '' })
function validateDemo() {
  formErrors.value.name = form.value.name ? '' : 'Nama wajib diisi'
  formErrors.value.qty = form.value.qty != null ? '' : 'Qty wajib diisi'
}
const categoryOptions = [
  { value: 'elektronik', label: 'Elektronik' },
  { value: 'sembako', label: 'Sembako' },
  { value: 'atk', label: 'ATK' },
]

// --- Modal demo ---
const showModal = ref(false)
const showFullscreenModal = ref(false)
const showConfirm = ref(false)
const showConfirmDanger = ref(false)
const confirmLoading = ref(false)
function simulateConfirmSubmit() {
  confirmLoading.value = true
  setTimeout(() => {
    confirmLoading.value = false
    showConfirmDanger.value = false
  }, 1200)
}

// --- Line items demo (mimics PO/SO item table with add/remove + subtotal) ---
interface LineItem { id: number; product: string; qty: number | null; price: number | null }
const items = ref<LineItem[]>([{ id: 1, product: '', qty: null, price: null }])
let nextItemId = 2
function addItem() {
  items.value.push({ id: nextItemId++, product: '', qty: null, price: null })
}
function removeItem(id: number) {
  items.value = items.value.filter((i) => i.id !== id)
}
function subtotal(item: LineItem) {
  return (item.qty ?? 0) * (item.price ?? 0)
}
const grandTotal = computed(() => items.value.reduce((sum, i) => sum + subtotal(i), 0))
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

// --- BaseDataTable demo (dummy server-side pagination simulated client-side) ---
interface DemoRow { id: number; sku: string; name: string; category: string; status: string; qty: number }
const allRows: DemoRow[] = Array.from({ length: 57 }, (_, i) => ({
  id: i + 1,
  sku: `SKU-${String(i + 1).padStart(4, '0')}`,
  name: `Produk Demo ${i + 1}`,
  category: ['Elektronik', 'Sembako', 'ATK'][i % 3],
  status: ['active', 'exhausted'][i % 2],
  qty: Math.floor(Math.random() * 200),
}))
const tableColumns = [
  { key: 'sku', label: 'SKU', sortable: true, width: '120px' },
  { key: 'name', label: 'Nama Produk', sortable: true },
  {
    key: 'category',
    label: 'Kategori',
    filterOptions: [
      { value: 'Elektronik', label: 'Elektronik' },
      { value: 'Sembako', label: 'Sembako' },
      { value: 'ATK', label: 'ATK' },
    ],
  },
  { key: 'qty', label: 'Qty', sortable: true, align: 'right' as const },
  { key: 'status', label: 'Status' },
]
const tablePage = ref(1)
const tablePageSize = 10
const tableSearch = ref('')
const tableCategoryFilter = ref('')
const tableSort = ref<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })
const tableLoading = ref(false)

const filteredRows = computed(() => {
  let rows = allRows
  if (tableSearch.value) {
    const q = tableSearch.value.toLowerCase()
    rows = rows.filter((r) => r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }
  if (tableCategoryFilter.value) {
    rows = rows.filter((r) => r.category === tableCategoryFilter.value)
  }
  if (tableSort.value.direction) {
    const { key, direction } = tableSort.value
    rows = [...rows].sort((a, b) => {
      const av = (a as any)[key]
      const bv = (b as any)[key]
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return direction === 'asc' ? cmp : -cmp
    })
  }
  return rows
})
const pagedRows = computed(() => {
  const start = (tablePage.value - 1) * tablePageSize
  return filteredRows.value.slice(start, start + tablePageSize)
})

function simulateServerDelay(fn: () => void) {
  tableLoading.value = true
  setTimeout(() => {
    fn()
    tableLoading.value = false
  }, 300)
}
function onSearchChange(v: string) {
  simulateServerDelay(() => {
    tableSearch.value = v
    tablePage.value = 1
  })
}
function onFilterChange({ key, value }: { key: string; value: string }) {
  if (key === 'category') {
    simulateServerDelay(() => {
      tableCategoryFilter.value = value
      tablePage.value = 1
    })
  }
}
function onSortChange(s: { key: string; direction: 'asc' | 'desc' | null }) {
  simulateServerDelay(() => (tableSort.value = s))
}
function onPageChange(p: number) {
  simulateServerDelay(() => (tablePage.value = p))
}
let deleteTarget: DemoRow | null = null
const showDeleteConfirm = ref(false)
function askDelete(row: DemoRow) {
  deleteTarget = row
  showDeleteConfirm.value = true
}
function confirmDelete() {
  showDeleteConfirm.value = false
}
</script>

<template>
  <div class="ui-kit-page">
    <h1>UI Kit — components/base/*</h1>
    <p class="lead">Halaman QA internal (tidak ada di sidebar) untuk review base component sebelum dipakai me-refactor halaman asli.</p>

    <!-- BUTTONS -->
    <section class="demo-card">
      <h2>BaseButton</h2>
      <div class="row-wrap">
        <BaseButton variant="primary">Primary</BaseButton>
        <BaseButton variant="secondary">Secondary</BaseButton>
        <BaseButton variant="danger">Danger</BaseButton>
        <BaseButton variant="ghost">Ghost</BaseButton>
        <BaseButton disabled>Disabled</BaseButton>
      </div>
      <div class="row-wrap" style="margin-top: 12px">
        <BaseButton size="sm">Small</BaseButton>
        <BaseButton size="md">Medium</BaseButton>
        <BaseButton size="lg">Large</BaseButton>
        <BaseButton :loading="btnLoading" @click="simulateSubmit">{{ btnLoading ? 'Menyimpan...' : 'Simulasi Submit' }}</BaseButton>
      </div>
    </section>

    <!-- BADGES -->
    <section class="demo-card">
      <h2>BaseBadge (status → warna otomatis)</h2>
      <div class="row-wrap">
        <BaseBadge v-for="s in statuses" :key="s" :status="s" />
      </div>
      <h3>Severity langsung (notifikasi)</h3>
      <div class="row-wrap">
        <BaseBadge tone="danger">Danger</BaseBadge>
        <BaseBadge tone="warning">Warning</BaseBadge>
        <BaseBadge tone="success">Success</BaseBadge>
        <BaseBadge tone="info">Info</BaseBadge>
        <BaseBadge tone="neutral">Neutral</BaseBadge>
      </div>
    </section>

    <!-- FORM FIELDS -->
    <section class="demo-card">
      <h2>Form Fields (outlined style, konsisten)</h2>
      <div class="form-grid">
        <BaseInput v-model="form.name" label="Nama Produk" required placeholder="Contoh: Kabel HDMI 2m" :error="formErrors.name" />
        <BaseSelect v-model="form.category" label="Kategori" :options="categoryOptions" helper-text="Contoh BaseSelect" />
        <BaseNumberInput v-model="form.qty" label="Qty" required placeholder="0" :error="formErrors.qty" helper-text="Tidak boleh negatif (default)" />
        <BaseNumberInput v-model="form.qtyDiff" label="Qty Diff (boleh negatif)" allow-negative placeholder="mis. -5" />
        <BaseDatePicker v-model="form.date" label="Tanggal" />
        <BaseTextarea v-model="form.note" label="Catatan" placeholder="Opsional" :rows="2" />
      </div>
      <BaseButton style="margin-top: 12px" @click="validateDemo">Trigger Validasi (contoh error state)</BaseButton>
    </section>

    <!-- LINE ITEMS TABLE (PO/SO style) -->
    <section class="demo-card">
      <h2>Tabel Line Item Dinamis (pola untuk PO/Shipment/Receiving/SO/DO items)</h2>
      <table class="line-items-table">
        <thead>
          <tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td><BaseInput v-model="item.product" placeholder="Nama produk" /></td>
            <td class="col-narrow"><BaseNumberInput v-model="item.qty" placeholder="0" /></td>
            <td class="col-narrow"><BaseNumberInput v-model="item.price" placeholder="0" /></td>
            <td class="col-narrow subtotal-cell">Rp {{ fmtCurrency(subtotal(item)) }}</td>
            <td><BaseButton variant="ghost" size="sm" @click="removeItem(item.id)">Hapus</BaseButton></td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td colspan="3" class="total-label">Total</td><td colspan="2" class="total-value">Rp {{ fmtCurrency(grandTotal) }}</td></tr>
        </tfoot>
      </table>
      <BaseButton variant="secondary" size="sm" style="margin-top: 8px" @click="addItem">+ Tambah Baris</BaseButton>
    </section>

    <!-- MODALS -->
    <section class="demo-card">
      <h2>BaseModal / BaseConfirmDialog</h2>
      <div class="row-wrap">
        <BaseButton @click="showModal = true">Buka Modal (md)</BaseButton>
        <BaseButton @click="showFullscreenModal = true">Buka Modal (fullscreen)</BaseButton>
        <BaseButton variant="secondary" @click="showConfirm = true">Confirm biasa</BaseButton>
        <BaseButton variant="danger" @click="showConfirmDanger = true">Confirm delete (danger)</BaseButton>
      </div>

      <BaseModal v-model="showModal" title="Contoh Form dalam Modal" size="md">
        <div class="form-grid">
          <BaseInput v-model="form.name" label="Nama" />
          <BaseSelect v-model="form.category" label="Kategori" :options="categoryOptions" />
        </div>
        <template #footer>
          <BaseButton variant="secondary" @click="showModal = false">Batal</BaseButton>
          <BaseButton @click="showModal = false">Simpan</BaseButton>
        </template>
      </BaseModal>

      <BaseModal v-model="showFullscreenModal" title="Contoh Modal Fullscreen" size="fullscreen">
        <p>Cocok untuk form kompleks seperti Purchase Order dengan banyak line item, tanpa pindah halaman penuh.</p>
        <template #footer>
          <BaseButton variant="secondary" @click="showFullscreenModal = false">Tutup</BaseButton>
        </template>
      </BaseModal>

      <BaseConfirmDialog v-model="showConfirm" title="Approve Dokumen?" message="PO-2026-001 akan disetujui dan lanjut ke tahap berikutnya." confirm-text="Ya, Approve" @confirm="showConfirm = false" />

      <BaseConfirmDialog
        v-model="showConfirmDanger"
        title="Hapus Data?"
        message="Tindakan ini tidak bisa dibatalkan. Yakin ingin menghapus?"
        confirm-text="Ya, Hapus"
        variant="danger"
        :loading="confirmLoading"
        @confirm="simulateConfirmSubmit"
      />
    </section>

    <!-- TOASTS -->
    <section class="demo-card">
      <h2>BaseToast</h2>
      <div class="toast-preview">
        <BaseToast severity="danger" title="Stok Kritis" message="Produk ABC di bawah batas minimum." />
        <BaseToast severity="warning" title="Reorder Point" message="Produk XYZ perlu dipesan ulang." />
        <BaseToast severity="info" title="Approval Baru" message="PO-2026-002 menunggu persetujuan Anda." />
      </div>
    </section>

    <!-- DATA TABLE -->
    <section class="demo-card">
      <h2>BaseDataTable (search + filter + sort + pagination, server-side event pattern)</h2>
      <BaseDataTable
        :columns="tableColumns"
        :data="pagedRows"
        :loading="tableLoading"
        :page="tablePage"
        :page-size="tablePageSize"
        :total-rows="filteredRows.length"
        search-placeholder="Cari SKU/Nama..."
        @search-change="onSearchChange"
        @filter-change="onFilterChange"
        @sort-change="onSortChange"
        @update:page="onPageChange"
      >
        <template #toolbar-actions>
          <BaseButton size="sm">+ Tambah</BaseButton>
        </template>
        <template #cell-status="{ value }">
          <BaseBadge :status="value" />
        </template>
        <template #cell-qty="{ value }">
          {{ fmtCurrency(value) }}
        </template>
        <template #actions="{ row }">
          <BaseButton variant="ghost" size="sm">Detail</BaseButton>
          <BaseButton variant="ghost" size="sm">Edit</BaseButton>
          <BaseButton variant="danger" size="sm" @click="askDelete(row)">Hapus</BaseButton>
        </template>
      </BaseDataTable>
      <p class="note">Search/filter/sort di atas cuma disimulasikan client-side (data dummy) — dipraktikkan sungguhan lewat query param API saat refactor halaman asli.</p>
    </section>

    <BaseConfirmDialog v-model="showDeleteConfirm" title="Hapus Produk?" message="Produk ini akan dihapus permanen." confirm-text="Ya, Hapus" variant="danger" @confirm="confirmDelete" />
  </div>
</template>

<style scoped>
.ui-kit-page {
  max-width: 1100px;
}
.lead {
  color: var(--color-text-muted);
  margin-bottom: 20px;
}
.demo-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-1);
  padding: 20px 24px;
  margin-bottom: 20px;
}
.demo-card h2 {
  font-size: 15px;
  margin: 0 0 12px;
}
.demo-card h3 {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 16px 0 8px;
}
.row-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
.line-items-table {
  width: 100%;
  border-collapse: collapse;
}
.line-items-table th {
  text-align: left;
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 6px 8px;
}
.line-items-table td {
  padding: 4px 8px;
  vertical-align: top;
}
.col-narrow {
  width: 130px;
}
.subtotal-cell {
  padding-top: 12px;
  font-size: 13px;
  font-weight: 600;
}
.total-label {
  text-align: right;
  font-weight: 600;
  padding-top: 12px;
}
.total-value {
  font-weight: 700;
  padding-top: 12px;
}
.toast-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.note {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 10px;
}
</style>
