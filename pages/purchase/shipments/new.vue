<script setup lang="ts">
// Create Shipment. Pick goods straight from open PO lines (search by PO /
// supplier / product), then fix quantities, weight (kg) and volume (CBM) per
// line. Weight and volume default from the product master and the summary
// panel totals them live. Lines can be removed any time before saving.
interface Offer {
  po_id: string; no_po: string; order_date: string; currency: string; supplier_id: string; supplier_name: string
  items: {
    item_id: string; product_id: string; sku: string; product_name: string; qty_order: number; qty_remaining: number; unit_price: number
    weight_kg: number | null
  }[]
}
interface Line {
  item_id: string; po_id: string; no_po: string; supplier_name: string; sku: string; product_name: string; product_id: string
  qty_remaining: number; unit_price: number
  qty: number | null
  weight: number | null; weightAuto: boolean; unitWeight: number | null
  volume: number | null; volumeAuto: boolean; unitVolume: number | null
}

const router = useRouter()
const notif = useNotificationStore()
const { expeditions, suppliers, loadMasters, fetchProductOptions, productLabel } = useMasters()

const search = ref('')
const supplierFilter = ref('')
const productFilter = ref('')
const offers = ref<Offer[]>([])
const loadingOffers = ref(false)
const showCount = ref(8)
const lines = ref<Line[]>([])
const saving = ref(false)
const errorMsg = ref('')

const form = reactive({
  expedition_id: '',
  ship_date: new Date().toISOString().slice(0, 10),
  eta_date: '',
  tracking_no: '',
  bl_number: '',
  container_no: '',
  total_shipping_cost: null as number | null,
  allocation_method: 'per_weight' as 'per_qty' | 'per_value' | 'per_weight',
  notes: '',
})

// ---------- picker ----------
let timer: ReturnType<typeof setTimeout> | undefined
async function loadOffers() {
  loadingOffers.value = true
  try {
    const query: Record<string, string> = {}
    if (search.value) query.search = search.value
    if (supplierFilter.value) query.supplier_id = supplierFilter.value
    if (productFilter.value) query.product_id = productFilter.value
    offers.value = await useApi<Offer[]>('/purchase-orders/shippable', { query })
    showCount.value = 8
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat PO'
  } finally {
    loadingOffers.value = false
  }
}
function onSearchInput() {
  clearTimeout(timer)
  timer = setTimeout(loadOffers, 300)
}
watch([supplierFilter, productFilter], loadOffers)
const hasFilter = computed(() => !!(search.value || supplierFilter.value || productFilter.value))
function resetFilters() {
  search.value = ''
  supplierFilter.value = ''
  productFilter.value = ''
}

onMounted(async () => {
  await loadMasters(['expeditions', 'suppliers', 'products'])
  await loadOffers()
})

const picked = (itemId: string) => lines.value.some((l) => l.item_id === itemId)

function lineFrom(po: Offer, it: Offer['items'][number]): Line {
  const unitVolume = unitVolumeCbm(it as any)
  const qty = it.qty_remaining
  return {
    item_id: it.item_id, po_id: po.po_id, no_po: po.no_po, supplier_name: po.supplier_name, sku: it.sku, product_name: it.product_name,
    product_id: it.product_id, qty_remaining: it.qty_remaining, unit_price: it.unit_price, qty,
    unitWeight: it.weight_kg, weight: it.weight_kg != null ? round3(it.weight_kg * qty) : null, weightAuto: true,
    unitVolume, volume: unitVolume != null ? roundCbm(unitVolume * qty) : null, volumeAuto: true,
  }
}
const round3 = (n: number) => Math.round(n * 1000) / 1000

function toggleItem(po: Offer, it: Offer['items'][number]) {
  if (picked(it.item_id)) removeLine(it.item_id)
  else lines.value.push(lineFrom(po, it))
}
const poAllPicked = (po: Offer) => po.items.every((i) => picked(i.item_id))
function togglePo(po: Offer) {
  if (poAllPicked(po)) po.items.forEach((i) => removeLine(i.item_id))
  else po.items.filter((i) => !picked(i.item_id)).forEach((i) => lines.value.push(lineFrom(po, i)))
}
function removeLine(itemId: string) {
  lines.value = lines.value.filter((l) => l.item_id !== itemId)
}

// Changing qty re-derives weight/volume unless the user typed them by hand.
function onQty(l: Line) {
  const q = l.qty ?? 0
  if (l.weightAuto && l.unitWeight != null) l.weight = round3(l.unitWeight * q)
  if (l.volumeAuto && l.unitVolume != null) l.volume = roundCbm(l.unitVolume * q)
}

// ---------- totals ----------
const totalQty = computed(() => lines.value.reduce((s, l) => s + (l.qty ?? 0), 0))
const totalWeight = computed(() => lines.value.reduce((s, l) => s + (l.weight ?? 0), 0))
const totalVolume = computed(() => lines.value.reduce((s, l) => s + (l.volume ?? 0), 0))
const totalValue = computed(() => lines.value.reduce((s, l) => s + (l.qty ?? 0) * l.unit_price, 0))
const poCount = computed(() => new Set(lines.value.map((l) => l.po_id)).size)
const missingDims = computed(() => lines.value.filter((l) => l.volume == null).length)
const missingWeight = computed(() => lines.value.filter((l) => l.weight == null).length)

function perUnitCost(l: Line) {
  const cost = form.total_shipping_cost ?? 0
  const qty = l.qty ?? 0
  if (!qty || !cost) return 0
  if (form.allocation_method === 'per_qty') return totalQty.value ? cost / totalQty.value : 0
  if (form.allocation_method === 'per_value') return totalValue.value ? (cost * ((qty * l.unit_price) / totalValue.value)) / qty : 0
  return totalWeight.value ? (cost * ((l.weight ?? 0) / totalWeight.value)) / qty : 0
}

function onExpeditionChange(id: string) {
  form.expedition_id = id
  const method = expeditions.value.find((e) => e.id === id)?.default_allocation_method
  if (method && ['per_qty', 'per_value', 'per_weight'].includes(method)) form.allocation_method = method as any
}

async function save() {
  errorMsg.value = ''
  if (!lines.value.length) {
    errorMsg.value = 'Pilih minimal satu barang dari PO'
    return
  }
  if (lines.value.some((l) => !l.qty || l.qty <= 0)) {
    errorMsg.value = 'Qty kirim harus lebih dari 0'
    return
  }
  const over = lines.value.find((l) => (l.qty ?? 0) > l.qty_remaining)
  if (over) {
    errorMsg.value = `Qty ${over.sku} melebihi sisa PO (${formatQty(over.qty_remaining)})`
    return
  }
  if (form.allocation_method === 'per_weight' && lines.value.some((l) => !l.weight || l.weight <= 0)) {
    errorMsg.value = 'Metode per berat membutuhkan berat (kg) di semua barang'
    return
  }
  saving.value = true
  try {
    const shp: any = await useApi('/shipments', {
      method: 'POST',
      body: {
        expedition_id: form.expedition_id,
        ship_date: form.ship_date,
        eta_date: form.eta_date || null,
        tracking_no: form.tracking_no || null,
        bl_number: form.bl_number || null,
        container_no: form.container_no || null,
        notes: form.notes || null,
        total_shipping_cost: form.total_shipping_cost ?? 0,
        allocation_method: form.allocation_method,
        po_ids: [...new Set(lines.value.map((l) => l.po_id))],
        items: lines.value.map((l) => ({
          po_item_id: l.item_id,
          qty_shipped: l.qty,
          ...(l.weight ? { weight: l.weight } : {}),
          ...(l.volume ? { volume: l.volume } : {}),
        })),
      },
    })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Shipment dibuat.' })
    await router.push(`/purchase/shipments/${shp.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat shipment'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Shipments', to: '/purchase/shipments' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Shipment" description="Pilih barang dari PO yang sudah disetujui, isi berat &amp; volume, lalu catat resi / BL / container." />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <form @submit.prevent="save">
      <div class="doc-layout">
        <div>
          <!-- 1. picker -->
          <section class="doc-card">
            <h2>1 · Pilih barang dari PO</h2>
            <div class="filters">
              <label class="search-box">
                <span>Cari</span>
                <input v-model="search" type="search" placeholder="No PO, supplier, SKU, atau nama produk…" @input="onSearchInput" />
              </label>
              <BaseSearchableSelect v-model="supplierFilter" label="Supplier" placeholder="Semua supplier" :options="suppliers.map((s) => ({ value: s.id, label: s.name }))" />
              <BaseAsyncSelect
                v-model="productFilter"
                :model-label="productLabel(productFilter)"
                label="Produk"
                placeholder="Cari produk…"
                :fetch-options="fetchProductOptions"
              />
              <BaseButton v-if="hasFilter" variant="ghost" size="sm" @click="resetFilters">Reset</BaseButton>
            </div>

            <p v-if="loadingOffers" class="muted">Memuat PO…</p>
            <p v-else-if="!offers.length" class="muted">Tidak ada PO yang cocok. PO harus berstatus approved / partial received dan masih punya sisa qty.</p>

            <div class="offers">
              <article v-for="po in offers.slice(0, showCount)" :key="po.po_id" class="offer">
                <header>
                  <label class="check">
                    <input type="checkbox" :checked="poAllPicked(po)" @change="togglePo(po)" />
                    <strong>{{ po.no_po }}</strong>
                  </label>
                  <span class="supplier">{{ po.supplier_name }}</span>
                  <span class="muted small">{{ po.order_date }} · {{ po.currency }}</span>
                  <BaseBadge :status="po.status" />
                </header>
                <ul>
                  <li v-for="it in po.items" :key="it.item_id" :class="{ on: picked(it.item_id) }" @click="toggleItem(po, it)">
                    <input type="checkbox" :checked="picked(it.item_id)" @click.stop @change="toggleItem(po, it)" />
                    <span class="prod"><strong>{{ it.sku }}</strong> {{ it.product_name }}</span>
                    <span class="num">sisa {{ formatQty(it.qty_remaining) }} <span class="muted small">/ {{ formatQty(it.qty_order) }}</span></span>
                    <span class="num muted small">Rp {{ formatNumber(it.unit_price) }}</span>
                  </li>
                </ul>
              </article>
            </div>
            <BaseButton v-if="offers.length > showCount" variant="secondary" size="sm" @click="showCount += 8">
              Tampilkan lebih banyak ({{ offers.length - showCount }} PO lagi)
            </BaseButton>
          </section>

          <!-- 2. details -->
          <section class="doc-card">
            <h2>2 · Detail pengiriman</h2>
            <div class="form-grid">
              <BaseSearchableSelect :model-value="form.expedition_id" label="Ekspedisi" required :options="expeditions.map((e) => ({ value: e.id, label: e.name }))" @update:model-value="onExpeditionChange" />
              <BaseDatePicker v-model="form.ship_date" label="Tanggal Kirim" required />
              <BaseDatePicker v-model="form.eta_date" label="Estimasi Tiba (ETA)" />
              <BaseInput v-model="form.bl_number" label="No BL (Bill of Lading)" />
              <BaseInput v-model="form.container_no" label="No Container" />
              <BaseInput v-model="form.tracking_no" label="No Resi / Tracking" />
              <BaseNumberInput v-model="form.total_shipping_cost" label="Total Biaya Kirim (Rp)" required />
              <BaseSelect
                v-model="form.allocation_method"
                label="Alokasi Biaya Kirim"
                :clearable="false"
                :options="[{ value: 'per_weight', label: 'Per Berat (kg)' }, { value: 'per_value', label: 'Per Nilai Barang' }, { value: 'per_qty', label: 'Per Qty' }]"
              />
            </div>
            <BaseTextarea v-model="form.notes" label="Catatan" :rows="2" />
          </section>

          <!-- 3. lines -->
          <section class="doc-card">
            <h2>3 · Barang di shipment ({{ lines.length }})</h2>
            <p v-if="!lines.length" class="muted">Belum ada barang. Centang barang di langkah 1.</p>
            <div v-else class="table-scroll">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>PO</th>
                    <th>Qty kirim</th>
                    <th>Berat total (kg)</th>
                    <th>Volume (CBM)</th>
                    <th class="num">Ongkir / unit</th>
                    <th class="num">Est. HPP / unit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="l in lines" :key="l.item_id">
                    <td><strong>{{ l.sku }}</strong><div class="muted small">{{ l.product_name }}</div></td>
                    <td class="small" style="min-width: 150px">{{ l.no_po }}<div class="muted">{{ l.supplier_name }}</div></td>
                    <td style="width: 120px"><BaseNumberInput v-model="l.qty" decimals="auto" :max="l.qty_remaining" required @update:model-value="onQty(l)" /></td>
                    <td style="width: 130px"><BaseNumberInput v-model="l.weight" :decimals="3" @update:model-value="l.weightAuto = false" /></td>
                    <td style="width: 130px"><BaseNumberInput v-model="l.volume" :decimals="4" @update:model-value="l.volumeAuto = false" /></td>
                    <td class="num">{{ formatNumber(perUnitCost(l)) }}</td>
                    <td class="num strong">{{ formatNumber(l.unit_price + perUnitCost(l)) }}</td>
                    <td><BaseButton variant="ghost" size="sm" title="Hapus dari shipment" @click="removeLine(l.item_id)">✕ Hapus</BaseButton></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <!-- summary -->
        <aside class="summary">
          <section class="doc-card">
            <h2>Ringkasan</h2>
            <dl class="sum">
              <div><dt>PO</dt><dd>{{ poCount }}</dd></div>
              <div><dt>Baris barang</dt><dd>{{ lines.length }}</dd></div>
              <div><dt>Total qty</dt><dd>{{ formatQty(totalQty) }}</dd></div>
              <div class="big"><dt>Total berat</dt><dd>{{ formatQty(totalWeight) }} kg</dd></div>
              <div class="big"><dt>Total volume</dt><dd>{{ formatNumber(totalVolume, 3) }} CBM</dd></div>
              <div><dt>Nilai barang</dt><dd>Rp {{ formatNumber(totalValue) }}</dd></div>
              <div v-if="form.total_shipping_cost && totalWeight"><dt>Ongkir / kg</dt><dd>Rp {{ formatNumber(form.total_shipping_cost / totalWeight) }}</dd></div>
              <div v-if="form.total_shipping_cost && totalVolume"><dt>Ongkir / CBM</dt><dd>Rp {{ formatNumber(form.total_shipping_cost / totalVolume) }}</dd></div>
            </dl>
            <p v-if="missingWeight" class="warn small">⚠ {{ missingWeight }} barang belum punya berat — isi manual atau lengkapi master product.</p>
            <p v-if="missingDims" class="warn small">⚠ {{ missingDims }} barang belum punya dimensi kemasan — volume diisi manual.</p>
          </section>
        </aside>
      </div>

      <div class="doc-sticky-bar">
        <NuxtLink to="/purchase/shipments"><BaseButton variant="secondary">Batal</BaseButton></NuxtLink>
        <BaseButton type="submit" :loading="saving" :disabled="!lines.length">Buat Shipment</BaseButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.small { font-size: 12px; }
.filters { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; margin-bottom: 14px; }
@media (max-width: 900px) { .filters { grid-template-columns: minmax(0, 1fr); } }
.search-box { display: grid; gap: 4px; }
.search-box span { font-size: 13px; font-weight: 500; color: var(--color-text); }
.search-box input { padding: 9px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; font-size: 13px; background: var(--color-surface); }
.search-box input:focus { outline: none; border-color: var(--color-primary); box-shadow: var(--focus-ring); }
.offers { display: grid; gap: 10px; margin-bottom: 12px; max-height: 520px; overflow-y: auto; padding-right: 4px; }
.offer { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.offer header { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; padding: 8px 12px; background: var(--color-bg); font-size: 13px; }
.offer .supplier { color: var(--color-text); }
.offer .check { display: flex; gap: 8px; align-items: center; cursor: pointer; }
.offer ul { list-style: none; margin: 0; padding: 0; }
.offer li { display: grid; grid-template-columns: 22px minmax(0, 1fr) 150px 110px; gap: 10px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--color-neutral-bg); font-size: 13px; cursor: pointer; transition: background 0.12s; }
.offer li:hover { background: var(--color-bg); }
.offer li.on { background: var(--color-primary-bg); }
.offer .num { text-align: right; font-variant-numeric: tabular-nums; }
.table-scroll { overflow-x: auto; }
.strong { font-weight: 700; }
.summary { position: sticky; top: 12px; }
.sum { margin: 0; display: grid; gap: 8px; font-size: 13px; }
.sum > div { display: flex; justify-content: space-between; gap: 10px; }
.sum dt { color: var(--color-text-muted); }
.sum dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.sum .big dd { font-size: 17px; color: var(--color-primary); }
.warn { color: #92400e; background: var(--color-warning-bg); border-radius: var(--radius-sm); padding: 6px 8px; margin: 10px 0 0; }
</style>
