<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const id = route.params.id as string
const auth = useAuthStore()
const swal = useSwal()
const notif = useNotificationStore()
const { loadMasters, suppliers } = useMasters()

const cmp = ref<any>(null)
const loading = ref(true)
const errorMsg = ref('')
const categories = ref<{ id: string; name: string }[]>([])
const units = ref<{ id: string; name: string }[]>([])

// null = nothing open, 'new:<groupKey>' = adding, '<candidateId>' = editing
const openEditor = ref<string | null>(null)

const rate = ref<number | null>(null)
const weights = reactive<Record<string, number>>({ price: 50, weight: 20, volume: 15, lead_time: 15 })
const savingSettings = ref(false)

async function load() {
  try {
    const data: any = await useApi(`/product-comparisons/${id}`)
    cmp.value = data
    rate.value = Number(data.exchange_rate)
    const w = data.weights as Record<string, number> | null
    if (w) {
      for (const k of ['price', 'weight', 'volume', 'lead_time'] as const) {
        if (typeof w[k] === 'number') weights[k] = Math.round(w[k] * 100)
      }
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat comparison'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadMasters(['suppliers'])
  const [c, u] = await Promise.all([useApi<any[]>('/product-categories'), useApi<any[]>('/units')])
  categories.value = c
  units.value = u
  await load()
})

const locked = computed(() => cmp.value?.status === 'closed')
const analysisOf = (cid: string) => cmp.value?.analysis.candidates.find((a: any) => a.id === cid)

// One compare table per requested item (+ a bucket for candidates not tied to an item).
const groups = computed(() => {
  if (!cmp.value) return []
  const list: { key: string; label: string; qty: string | null; candidates: any[] }[] = cmp.value.request_items.map((ri: any) => ({
    key: ri.id,
    label: ri.name,
    qty: `${formatQty(ri.qty)} ${ri.unit ?? ''}`.trim(),
    candidates: cmp.value.candidates.filter((c: any) => c.request_item_id === ri.id),
  }))
  const loose = cmp.value.candidates.filter((c: any) => !c.request_item_id)
  if (loose.length) list.push({ key: 'none', label: 'Tanpa item spesifik', qty: null, candidates: loose })
  return list
})

const selected = computed(() => (cmp.value?.candidates ?? []).filter((c: any) => c.is_selected))
const toPromote = computed(() => selected.value.filter((c: any) => !c.promoted_product_id))
const canMakePo = computed(() => selected.value.length > 0 && toPromote.value.length === 0)

const fmtDims = (a: any, b: any, c: any) => (a && b && c ? `${formatQty(a)} × ${formatQty(b)} × ${formatQty(c)}` : '-')
const price = (c: any) => `${c.currency === 'RMB' ? '¥' : 'Rp'} ${formatNumber(c.price)}`
const photoSrc = (pid: string) => `/api/v1/attachments/${pid}/file?token=${auth.accessToken ?? ''}`

async function saveSettings() {
  savingSettings.value = true
  try {
    await useApi(`/product-comparisons/${id}`, {
      method: 'PUT',
      body: {
        exchange_rate: rate.value ?? 1,
        weights: {
          price: weights.price / 100,
          weight: weights.weight / 100,
          volume: weights.volume / 100,
          lead_time: weights.lead_time / 100,
        },
      },
    })
    notif.pushToast({ severity: 'success', title: 'Tersimpan', message: 'Kurs dan bobot analisa diperbarui.' })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  } finally {
    savingSettings.value = false
  }
}

async function setStatus(status: string) {
  try {
    await useApi(`/product-comparisons/${id}`, { method: 'PUT', body: { status } })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

async function toggleSelect(c: any) {
  try {
    await useApi(`/comparison-candidates/${c.id}/select`, { method: 'POST', body: { selected: !c.is_selected } })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}

async function onEditorSaved() {
  openEditor.value = null
  await load()
}

// --- promote to product master ---
const showPromote = ref(false)
const promoting = ref(false)
const promoteRows = ref<{ candidate_id: string; name: string; sku: string; category_id: string; base_unit_id: string }[]>([])

function openPromote() {
  promoteRows.value = toPromote.value.map((c: any) => ({ candidate_id: c.id, name: c.name, sku: '', category_id: '', base_unit_id: '' }))
  showPromote.value = true
}
async function doPromote() {
  promoting.value = true
  try {
    await useApi(`/product-comparisons/${id}/promote`, {
      method: 'POST',
      body: {
        items: promoteRows.value.map((r) => ({
          candidate_id: r.candidate_id,
          name: r.name || undefined,
          sku: r.sku || undefined,
          category_id: r.category_id || null,
          base_unit_id: r.base_unit_id || null,
        })),
      },
    })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Produk terpilih sudah masuk master product.' })
    showPromote.value = false
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  } finally {
    promoting.value = false
  }
}

const metricLabel: Record<string, string> = { price: 'Harga', weight: 'Berat', volume: 'Volume', lead_time: 'Lead time' }
const bestClass = (cid: string, metric: string) => (analysisOf(cid)?.best_in.includes(metric) ? 'best' : '')

async function removeComparison() {
  if (!(await swal.confirmDelete(cmp.value.no_comparison))) return
  try {
    await useApi(`/product-comparisons/${id}`, { method: 'DELETE' })
    await navigateTo('/purchase/comparisons')
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal menghapus', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  }
}
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Product Comparison', to: '/purchase/comparisons' }, { label: cmp?.no_comparison ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="cmp">
      <BasePageHeader :title="cmp.title" :description="`${cmp.no_comparison} · Request ${cmp.request?.no_request ?? '-'}`">
        <template #actions>
          <div class="doc-actions">
            <BaseBadge :status="cmp.status" />
            <BaseSelect
              class="status-select"
              :model-value="cmp.status"
              :clearable="false"
              :options="[{ value: 'draft', label: 'Draft' }, { value: 'in_review', label: 'In Review' }, { value: 'decided', label: 'Decided' }, { value: 'closed', label: 'Closed' }]"
              @update:model-value="(v) => v && setStatus(v)"
            />
            <BaseButton variant="secondary" size="sm" :disabled="!toPromote.length || locked" @click="openPromote">
              Jadikan Master Product ({{ toPromote.length }})
            </BaseButton>
            <NuxtLink v-if="canMakePo" :to="`/purchase/orders/new?comparison_id=${id}`"><BaseButton size="sm">Buat PO</BaseButton></NuxtLink>
            <BaseButton v-else size="sm" disabled :title="selected.length ? 'Jadikan master product dulu' : 'Pilih kandidat dulu'">Buat PO</BaseButton>
            <BaseButton v-if="cmp.status === 'draft'" variant="danger" size="sm" @click="removeComparison">Hapus</BaseButton>
          </div>
        </template>
      </BasePageHeader>

      <!-- Analysis summary -->
      <section class="doc-card analysis">
        <h2>🏆 Analisa — mana yang bagus?</h2>
        <ul v-if="cmp.analysis.summary.length">
          <li v-for="(s, i) in cmp.analysis.summary" :key="i">{{ s }}</li>
        </ul>
        <p class="muted small">
          Skor 0–100 membandingkan harga (dalam IDR), berat, volume kemasan dan lead time — makin kecil makin baik.
          Data yang kosong tidak ikut dihitung.
        </p>
        <details>
          <summary>Atur kurs &amp; bobot penilaian</summary>
          <div class="settings">
            <BaseNumberInput v-model="rate" label="Kurs RMB → IDR" :disabled="locked" />
            <label v-for="(label, key) in metricLabel" :key="key" class="slider">
              <span>{{ label }}: <strong>{{ weights[key] }}%</strong></span>
              <input v-model.number="weights[key]" type="range" min="0" max="100" step="5" :disabled="locked" />
            </label>
            <BaseButton size="sm" :loading="savingSettings" :disabled="locked" @click="saveSettings">Simpan &amp; Hitung Ulang</BaseButton>
          </div>
        </details>
      </section>

      <!-- One compare table per requested item -->
      <section v-for="g in groups" :key="g.key" class="doc-card">
        <div class="group-head">
          <h2>{{ g.label }} <span v-if="g.qty" class="muted">· {{ g.qty }}</span></h2>
          <BaseButton v-if="!locked" variant="secondary" size="sm" @click="openEditor = `new:${g.key}`">+ Kandidat</BaseButton>
        </div>

        <div v-if="openEditor === `new:${g.key}`" class="editor-slot">
          <CandidateEditor
            :comparison-id="id"
            :request-items="cmp.request_items"
            :suppliers="suppliers"
            :default-request-item-id="g.key === 'none' ? null : g.key"
            @saved="onEditorSaved"
            @cancel="openEditor = null"
          />
        </div>

        <p v-if="!g.candidates.length && openEditor !== `new:${g.key}`" class="muted">Belum ada kandidat. Tambahkan minimal 2 untuk dibandingkan.</p>

        <div v-if="g.candidates.length" class="matrix-wrap">
          <table class="matrix">
            <thead>
              <tr>
                <th />
                <th v-for="c in g.candidates" :key="c.id" :class="{ chosen: c.is_selected, rec: analysisOf(c.id)?.is_recommended }">
                  {{ c.name }}
                  <BaseBadge v-if="analysisOf(c.id)?.is_recommended" status="success">rekomendasi</BaseBadge>
                  <BaseBadge v-if="c.promoted_product_id" status="info">master</BaseBadge>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Foto</th>
                <td v-for="c in g.candidates" :key="c.id">
                  <div class="thumbs">
                    <img v-for="pid in c.photo_ids.slice(0, 4)" :key="pid" :src="photoSrc(pid)" alt="foto" loading="lazy" />
                    <span v-if="!c.photo_ids.length" class="muted small">tanpa foto</span>
                  </div>
                </td>
              </tr>
              <tr><th>Supplier</th><td v-for="c in g.candidates" :key="c.id">{{ c.supplier_name ?? '-' }}</td></tr>
              <tr>
                <th>Harga</th>
                <td v-for="c in g.candidates" :key="c.id" :class="bestClass(c.id, 'price')">
                  {{ price(c) }}
                  <div v-if="c.currency === 'RMB'" class="muted small">≈ Rp {{ formatNumber(analysisOf(c.id)?.price_idr) }}</div>
                </td>
              </tr>
              <tr><th>Berat</th><td v-for="c in g.candidates" :key="c.id" :class="bestClass(c.id, 'weight')">{{ c.weight_kg ? `${formatQty(c.weight_kg)} kg` : '-' }}</td></tr>
              <tr><th>Dimensi produk (cm)</th><td v-for="c in g.candidates" :key="c.id">{{ fmtDims(c.length_cm, c.width_cm, c.height_cm) }}</td></tr>
              <tr><th>Dimensi kemasan (cm)</th><td v-for="c in g.candidates" :key="c.id">{{ fmtDims(c.pack_length_cm, c.pack_width_cm, c.pack_height_cm) }}</td></tr>
              <tr>
                <th>Volume kemasan</th>
                <td v-for="c in g.candidates" :key="c.id" :class="bestClass(c.id, 'volume')">
                  {{ analysisOf(c.id)?.volume_cm3 ? `${formatNumber(analysisOf(c.id)?.volume_cm3 / 1000, 2)} L` : '-' }}
                </td>
              </tr>
              <tr>
                <th>Lead time</th>
                <td v-for="c in g.candidates" :key="c.id" :class="bestClass(c.id, 'lead_time')">{{ analysisOf(c.id)?.metrics.lead_time ? `${analysisOf(c.id).metrics.lead_time} hari` : '-' }}</td>
              </tr>
              <tr><th>MOQ</th><td v-for="c in g.candidates" :key="c.id">{{ c.moq ? formatQty(c.moq) : '-' }}</td></tr>
              <tr><th>Catatan</th><td v-for="c in g.candidates" :key="c.id" class="note-cell">{{ c.notes || '-' }}</td></tr>
              <tr class="score-row">
                <th>Skor</th>
                <td v-for="c in g.candidates" :key="c.id">
                  <div class="score"><div class="bar" :style="{ width: `${analysisOf(c.id)?.score ?? 0}%` }" /></div>
                  <strong>{{ analysisOf(c.id)?.score ?? 0 }}</strong>
                  <span class="muted small"> · peringkat {{ analysisOf(c.id)?.rank }}</span>
                </td>
              </tr>
              <tr>
                <th>Pilih</th>
                <td v-for="c in g.candidates" :key="c.id" class="pick">
                  <BaseButton :variant="c.is_selected ? 'primary' : 'secondary'" size="sm" :disabled="locked" @click="toggleSelect(c)">
                    {{ c.is_selected ? '✓ Dipilih' : 'Pilih' }}
                  </BaseButton>
                  <BaseButton variant="ghost" size="sm" :disabled="locked" @click="openEditor = c.id">Ubah</BaseButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <template v-for="c in g.candidates" :key="`ed-${c.id}`">
          <div v-if="openEditor === c.id" class="editor-slot">
            <CandidateEditor
              :comparison-id="id"
              :candidate="c"
              :request-items="cmp.request_items"
              :suppliers="suppliers"
              :locked="locked"
              @saved="onEditorSaved"
              @removed="onEditorSaved"
            />
            <BaseButton variant="ghost" size="sm" @click="openEditor = null">Tutup</BaseButton>
          </div>
        </template>
      </section>

      <section v-if="cmp.notes" class="doc-card"><h2>Catatan</h2><p class="pre">{{ cmp.notes }}</p></section>
    </template>

    <!-- promote dialog -->
    <BaseModal v-model="showPromote" title="Jadikan Master Product" size="lg">
      <p class="muted small">Hanya kandidat yang dipilih. SKU boleh dikosongkan — akan dibuat otomatis.</p>
      <div v-for="r in promoteRows" :key="r.candidate_id" class="promote-row">
        <BaseInput v-model="r.name" label="Nama Produk" />
        <BaseInput v-model="r.sku" label="SKU" placeholder="otomatis" />
        <BaseSearchableSelect v-model="r.category_id" label="Kategori" :options="categories.map((c) => ({ value: c.id, label: c.name }))" />
        <BaseSearchableSelect v-model="r.base_unit_id" label="Satuan" :options="units.map((u) => ({ value: u.id, label: u.name }))" />
      </div>
      <template #footer>
        <BaseButton variant="secondary" :disabled="promoting" @click="showPromote = false">Batal</BaseButton>
        <BaseButton :loading="promoting" @click="doPromote">Masukkan ke Master</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.small { font-size: 12px; }
.pre { white-space: pre-wrap; margin: 0; font-size: 13px; }
.status-select { width: 150px; }
.analysis ul { margin: 0 0 8px; padding-left: 18px; font-size: 14px; }
.analysis summary { cursor: pointer; font-size: 13px; color: var(--color-primary); margin-top: 6px; }
.settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: end; margin-top: 10px; }
.slider { display: grid; gap: 4px; font-size: 12px; }
.group-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.group-head h2 { margin: 0; font-size: 15px; }
.editor-slot { margin: 10px 0; display: grid; gap: 6px; justify-items: start; }
.editor-slot > :first-child { width: 100%; }
.matrix-wrap { overflow-x: auto; }
.matrix { border-collapse: collapse; min-width: 100%; font-size: 13px; }
.matrix th, .matrix td { border: 1px solid var(--color-border); padding: 8px 10px; vertical-align: top; min-width: 170px; text-align: left; }
.matrix tbody th { background: var(--color-bg); font-size: 12px; color: var(--color-text-muted); min-width: 130px; position: sticky; left: 0; }
.matrix thead th { background: var(--color-bg); }
.matrix thead th.chosen { background: var(--color-primary-bg); box-shadow: inset 0 -3px var(--color-primary); }
.matrix thead th.rec { box-shadow: inset 0 -3px var(--color-normal); }
.matrix td.best { background: var(--color-normal-bg); font-weight: 600; color: #166534; }
.matrix td.pick { display: table-cell; }
.note-cell { white-space: pre-wrap; max-width: 240px; }
.thumbs { display: flex; gap: 4px; flex-wrap: wrap; }
.thumbs img { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; border: 1px solid var(--color-border); }
.score { height: 6px; background: var(--color-neutral-bg); border-radius: 4px; overflow: hidden; margin-bottom: 4px; }
.score .bar { height: 100%; background: linear-gradient(90deg, var(--color-info), var(--color-normal)); }
.promote-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); }
@media (max-width: 900px) { .promote-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
