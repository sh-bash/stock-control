<script setup lang="ts">
const id = useRoute().params.id as string
const notif = useNotificationStore()
const { loadMasters, expeditionName, productLabel } = useMasters()

const shp = ref<any>(null)
const poItems = ref<Record<string, any>>({})
const poNos = ref<Record<string, string>>({})
const loading = ref(true)
const errorMsg = ref('')
const advancing = ref(false)

const STEPS = [
  { key: 'draft', label: 'Draft', icon: '📝' },
  { key: 'in_transit', label: 'Dalam Perjalanan', icon: '🚚' },
  { key: 'arrived', label: 'Tiba', icon: '📍' },
  { key: 'completed', label: 'Selesai', icon: '✅' },
]
const stepIndex = computed(() => STEPS.findIndex((s) => s.key === shp.value?.status))
const nextStep = computed(() => STEPS[stepIndex.value + 1] ?? null)

async function load() {
  try {
    const data: any = await useApi(`/shipments/${id}`)
    shp.value = data
    for (const ref of data.po_refs) {
      const po: any = await useApi(`/purchase-orders/${ref.po_id}`)
      poNos.value[ref.po_id] = po.no_po
      for (const it of po.items) poItems.value[it.id] = { ...it, po_id: ref.po_id }
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat shipment'
  } finally {
    loading.value = false
  }
}

async function advance() {
  if (!nextStep.value) return
  advancing.value = true
  try {
    await useApi(`/shipments/${id}/status`, { method: 'POST', body: { status: nextStep.value.key } })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: `Status shipment: ${nextStep.value.label}.` })
    await load()
  } catch (err: any) {
    notif.pushToast({ severity: 'danger', title: 'Gagal', message: err?.data?.data?.message || 'Terjadi kesalahan' })
  } finally {
    advancing.value = false
  }
}

const rows = computed(() =>
  (shp.value?.items ?? []).map((i: any) => {
    const poItem = poItems.value[i.po_item_id]
    const unit = Number(poItem?.unit_price ?? 0)
    const ship = Number(i.allocated_shipping_cost_per_unit ?? 0)
    return { ...i, product_id: poItem?.product_id, po_id: poItem?.po_id, unit, ship, landed: unit + ship }
  }),
)
const totalQty = computed(() => rows.value.reduce((s: number, r: any) => s + Number(r.qty_shipped), 0))

onMounted(async () => {
  await loadMasters(['expeditions', 'products'])
  await load()
})
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Shipments', to: '/purchase/shipments' }, { label: shp?.no_shipment ?? '…' }]" />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-else-if="shp">
      <BasePageHeader :title="shp.no_shipment" :description="expeditionName(shp.expedition_id)">
        <template #actions>
          <div class="doc-actions">
            <BaseButton v-if="nextStep" size="sm" :loading="advancing" @click="advance">{{ nextStep.icon }} Tandai: {{ nextStep.label }}</BaseButton>
            <NuxtLink v-if="shp.status !== 'draft'" to="/purchase/receivings/new"><BaseButton variant="secondary" size="sm">Buat Receiving</BaseButton></NuxtLink>
          </div>
        </template>
      </BasePageHeader>

      <ol class="stepper">
        <li v-for="(s, i) in STEPS" :key="s.key" :class="{ done: i < stepIndex, current: i === stepIndex }">
          <span class="dot">{{ i < stepIndex ? '✓' : s.icon }}</span>
          <span class="lbl">{{ s.label }}</span>
        </li>
      </ol>

      <div class="stats">
        <div class="stat"><span>Total Berat</span><strong>{{ shp.total_weight ? `${formatQty(shp.total_weight)} kg` : '-' }}</strong></div>
        <div class="stat"><span>Total Volume</span><strong>{{ shp.total_volume ? `${formatNumber(shp.total_volume, 3)} CBM` : '-' }}</strong></div>
        <div class="stat"><span>Total Qty</span><strong>{{ formatQty(totalQty) }}</strong></div>
        <div class="stat"><span>Biaya Kirim</span><strong>Rp {{ formatNumber(shp.total_shipping_cost) }}</strong></div>
        <div class="stat"><span>Biaya / kg</span><strong>{{ shp.total_weight && Number(shp.total_weight) ? `Rp ${formatNumber(Number(shp.total_shipping_cost) / Number(shp.total_weight))}` : '-' }}</strong></div>
      </div>

      <section class="doc-card">
        <dl class="doc-meta">
          <div><dt>Tanggal Kirim</dt><dd>{{ shp.ship_date }}</dd></div>
          <div><dt>ETA</dt><dd>{{ shp.eta_date || '-' }}</dd></div>
          <div><dt>No BL</dt><dd>{{ shp.bl_number || '-' }}</dd></div>
          <div><dt>No Container</dt><dd>{{ shp.container_no || '-' }}</dd></div>
          <div><dt>No Resi</dt><dd>{{ shp.tracking_no || '-' }}</dd></div>
          <div><dt>Alokasi</dt><dd>{{ ({ per_qty: 'Per Qty', per_value: 'Per Nilai', per_weight: 'Per Berat' } as any)[shp.allocation_method] }}</dd></div>
          <div>
            <dt>PO</dt>
            <dd><NuxtLink v-for="r in shp.po_refs" :key="r.id" :to="`/purchase/orders/${r.po_id}`" class="link-cell po-link">{{ poNos[r.po_id] ?? 'PO' }}</NuxtLink></dd>
          </div>
        </dl>
        <p v-if="shp.notes" class="notes">{{ shp.notes }}</p>
      </section>

      <section class="doc-card">
        <h2>Item</h2>
        <div class="table-scroll">
          <table class="doc-table">
            <thead>
              <tr><th>Produk</th><th class="num">Qty</th><th class="num">Berat (kg)</th><th class="num">Volume (CBM)</th><th class="num">Harga / unit</th><th class="num">Ongkir / unit</th><th class="num">HPP / unit</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.id">
                <td>{{ productLabel(r.product_id) }}</td>
                <td class="num">{{ formatQty(r.qty_shipped) }}</td>
                <td class="num">{{ r.weight ? formatQty(r.weight) : '-' }}</td>
                <td class="num">{{ r.volume ? formatNumber(r.volume, 4) : '-' }}</td>
                <td class="num">{{ formatNumber(r.unit) }}</td>
                <td class="num">{{ formatNumber(r.ship) }}</td>
                <td class="num strong">{{ formatNumber(r.landed) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.stepper { list-style: none; display: flex; padding: 0; margin: 0 0 16px; gap: 0; }
.stepper li { flex: 1; display: grid; justify-items: center; gap: 4px; position: relative; font-size: 12px; color: var(--color-text-muted); }
.stepper li::before { content: ''; position: absolute; top: 16px; left: -50%; width: 100%; height: 3px; background: var(--color-neutral-bg); z-index: 0; }
.stepper li:first-child::before { display: none; }
.stepper li.done::before, .stepper li.current::before { background: var(--color-primary); }
.dot { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--color-neutral-bg); z-index: 1; font-size: 15px; }
.stepper li.done .dot { background: var(--color-primary); color: #fff; }
.stepper li.current .dot { background: var(--color-primary-bg); box-shadow: 0 0 0 3px var(--color-primary); }
.stepper li.current .lbl { color: var(--color-primary); font-weight: 600; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat { background: var(--color-surface); border-radius: var(--radius-md); box-shadow: var(--elevation-1); padding: 12px 14px; display: grid; gap: 2px; }
.stat span { font-size: 11px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.stat strong { font-size: 18px; }
.notes { margin: 12px 0 0; font-size: 13px; white-space: pre-wrap; }
.po-link { margin-right: 8px; }
.table-scroll { overflow-x: auto; }
.strong { font-weight: 700; }
</style>
