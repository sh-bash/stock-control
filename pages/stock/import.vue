<script setup lang="ts">
// Import stock from Excel/CSV. Two steps — preview (nothing written) then
// commit. Products with no history in a warehouse become opening balance;
// any difference against current stock is booked as saldo in / saldo minus.
interface PlanRow {
  row_no: number
  sku: string
  warehouse: string
  qty: number | null
  hpp: number | null
  product_name: string | null
  warehouse_name: string | null
  qty_before: number
  qty_diff: number
  hpp_used: number | null
  action: 'opening_balance' | 'adjust_in' | 'adjust_out' | 'unchanged' | null
  error: string | null
}

const swal = useSwal()
const notif = useNotificationStore()

const file = ref<File | null>(null)
const importDate = ref(new Date().toISOString().slice(0, 10))
const preview = ref<{ summary: any; rows: PlanRow[] } | null>(null)
const busy = ref<'preview' | 'commit' | null>(null)
const errorMsg = ref('')
const batches = ref<any[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

const ACTION_LABEL: Record<string, { text: string; tone: string }> = {
  opening_balance: { text: 'Saldo awal', tone: 'info' },
  adjust_in: { text: 'Saldo masuk (+)', tone: 'success' },
  adjust_out: { text: 'Saldo minus (−)', tone: 'danger' },
  unchanged: { text: 'Tidak berubah', tone: 'neutral' },
}

// Parse .xlsx / .csv in the browser (first sheet, header row = column names) and
// send the rows as JSON — the server never needs a spreadsheet library.
async function readRows(f: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('File tidak punya sheet')
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}

async function send(mode: 'preview' | 'commit') {
  if (!file.value) return
  let rows: Record<string, unknown>[]
  try {
    rows = await readRows(file.value)
  } catch {
    throw { data: { data: { message: 'File tidak bisa dibaca. Gunakan format .xlsx atau .csv' } } }
  }
  return useApi<any>('/stock/import', {
    method: 'POST',
    body: { mode, import_date: importDate.value, file_name: file.value.name, rows },
  })
}

async function runPreview() {
  errorMsg.value = ''
  busy.value = 'preview'
  try {
    preview.value = await send('preview')
  } catch (err: any) {
    preview.value = null
    errorMsg.value = err?.data?.data?.message || 'Gagal membaca file'
  } finally {
    busy.value = null
  }
}

async function runCommit() {
  const s = preview.value!.summary
  const ok = await swal.confirmAction({
    title: 'Terapkan import stok?',
    message: `${s.opening_rows} saldo awal, ${s.adjust_in_rows} penambahan, ${s.adjust_out_rows} pengurangan. Stok dan riwayat (ledger) akan berubah dan tidak bisa dibatalkan otomatis.`,
    confirmText: 'Ya, Terapkan',
  })
  if (!ok) return
  busy.value = 'commit'
  errorMsg.value = ''
  try {
    await send('commit')
    notif.pushToast({ severity: 'success', title: 'Import berhasil', message: 'Stok sudah diperbarui dan tercatat di ledger.' })
    preview.value = null
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
    await loadBatches()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menerapkan import'
  } finally {
    busy.value = null
  }
}

function onFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
  preview.value = null
}

function downloadTemplate() {
  const csv = '﻿sku,warehouse,qty,hpp\nSKU-001,WH-A,100,25000\nSKU-002,WH-A,40,12500\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-import-stok.csv'
  a.click()
  URL.revokeObjectURL(url)
}

async function loadBatches() {
  batches.value = await useApi<any[]>('/stock/import')
}
onMounted(loadBatches)
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Stock', to: '/stock/overview' }, { label: 'Import Stock' }]" />
    <BasePageHeader title="Import Stock" description="Muat stok dari Excel/CSV. Produk yang belum punya stok menjadi saldo awal; selisih dengan stok sistem dicatat sebagai saldo masuk / minus." />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <section class="doc-card">
      <h2>1 · Pilih file</h2>
      <div class="form-grid">
        <label class="file-box">
          <span>File .xlsx / .csv</span>
          <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" @change="onFile" />
        </label>
        <BaseDatePicker v-model="importDate" label="Tanggal saldo (untuk layer FIFO)" />
      </div>
      <p class="muted small">
        Kolom: <code>sku</code>, <code>warehouse</code> (kode atau nama gudang), <code>qty</code> (stok yang benar), <code>hpp</code>
        (wajib untuk saldo awal / penambahan; boleh kosong untuk pengurangan).
        <button class="link-cell" @click="downloadTemplate">Unduh template</button>
      </p>
      <BaseButton :disabled="!file" :loading="busy === 'preview'" @click="runPreview">Preview</BaseButton>
    </section>

    <section v-if="preview" class="doc-card">
      <h2>2 · Hasil preview</h2>
      <div class="chips">
        <span class="chip">{{ preview.summary.total_rows }} baris</span>
        <span class="chip info">{{ preview.summary.opening_rows }} saldo awal</span>
        <span class="chip ok">{{ preview.summary.adjust_in_rows }} masuk</span>
        <span class="chip bad">{{ preview.summary.adjust_out_rows }} minus</span>
        <span class="chip">{{ preview.summary.unchanged_rows }} tetap</span>
        <span v-if="preview.summary.error_rows" class="chip err">{{ preview.summary.error_rows }} error</span>
      </div>

      <div class="table-scroll">
        <table class="doc-table">
          <thead>
            <tr><th>#</th><th>SKU</th><th>Produk</th><th>Gudang</th><th class="num">Stok sistem</th><th class="num">Stok import</th><th class="num">Selisih</th><th class="num">HPP</th><th>Hasil</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in preview.rows" :key="r.row_no" :class="{ bad: r.error }">
              <td>{{ r.row_no }}</td>
              <td>{{ r.sku }}</td>
              <td>{{ r.product_name ?? '-' }}</td>
              <td>{{ r.warehouse_name ?? r.warehouse }}</td>
              <td class="num">{{ formatQty(r.qty_before) }}</td>
              <td class="num">{{ r.qty == null ? '-' : formatQty(r.qty) }}</td>
              <td class="num" :style="{ color: r.qty_diff < 0 ? 'var(--color-danger)' : r.qty_diff > 0 ? 'var(--color-normal)' : '' }">{{ r.qty_diff > 0 ? '+' : '' }}{{ formatQty(r.qty_diff) }}</td>
              <td class="num">{{ r.hpp_used == null ? '-' : formatNumber(r.hpp_used) }}</td>
              <td>
                <span v-if="r.error" class="errmsg">{{ r.error }}</span>
                <BaseBadge v-else-if="r.action" :status="ACTION_LABEL[r.action].tone">{{ ACTION_LABEL[r.action].text }}</BaseBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="doc-actions" style="margin-top: 14px">
        <BaseButton :disabled="preview.summary.error_rows > 0" :loading="busy === 'commit'" @click="runCommit">Terapkan Import</BaseButton>
        <span v-if="preview.summary.error_rows > 0" class="muted small">Perbaiki baris bermasalah di file, lalu preview ulang.</span>
      </div>
    </section>

    <section class="doc-card">
      <h2>Riwayat import</h2>
      <p v-if="!batches.length" class="muted">Belum ada import.</p>
      <table v-else class="doc-table">
        <thead><tr><th>No Batch</th><th>File</th><th>Tanggal</th><th class="num">Baris</th><th class="num">Saldo awal</th><th class="num">Masuk</th><th class="num">Minus</th></tr></thead>
        <tbody>
          <tr v-for="b in batches" :key="b.id">
            <td>{{ b.no_batch }}</td>
            <td>{{ b.file_name || '-' }}</td>
            <td>{{ b.import_date }}</td>
            <td class="num">{{ b.total_rows }}</td>
            <td class="num">{{ b.opening_rows }}</td>
            <td class="num">{{ b.adjust_in_rows }}</td>
            <td class="num">{{ b.adjust_out_rows }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.small { font-size: 12px; }
.file-box { display: grid; gap: 4px; font-size: 12px; color: var(--color-text-muted); }
.file-box input { font-size: 13px; padding: 6px; border: 1px dashed var(--color-border); border-radius: var(--radius-sm); }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.chip { padding: 3px 10px; border-radius: 999px; font-size: 12px; background: var(--color-neutral-bg); }
.chip.info { background: var(--color-info-bg); color: var(--color-info); }
.chip.ok { background: var(--color-normal-bg); color: var(--color-normal); }
.chip.bad { background: var(--color-danger-bg); color: var(--color-danger); }
.chip.err { background: var(--color-danger); color: #fff; }
tr.bad { background: var(--color-danger-bg); }
.errmsg { color: var(--color-danger); font-size: 12px; }
.table-scroll { overflow-x: auto; max-height: 460px; overflow-y: auto; }
code { background: var(--color-neutral-bg); padding: 0 4px; border-radius: 4px; }
</style>
