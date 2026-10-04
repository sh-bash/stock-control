<script setup lang="ts">
// Create / edit form for a Purchase Order (separate page, not a modal).
// A PO can be free-form, or prefilled from a Product Request and/or a Product
// Comparison (?request_id= / ?comparison_id=). Prices are typed in the PO's
// currency; with RMB the rate on this PO converts every line to IDR live.
const props = defineProps<{ id?: string }>()

interface Row { product_id: string; candidate_id: string | null; name: string; qty_order: number | null; price: number | null }

const route = useRoute()
const router = useRouter()
const notif = useNotificationStore()
const { suppliers, warehouses, loadMasters, productLabel, fetchProductOptions } = useMasters()

const form = reactive({
  supplier_id: '',
  warehouse_id: '',
  order_date: new Date().toISOString().slice(0, 10),
  currency: 'IDR' as 'IDR' | 'RMB',
  exchange_rate: null as number | null,
  request_id: '' as string,
  comparison_id: '' as string,
  notes: '',
})
const rows = ref<Row[]>([emptyRow()])
const requests = ref<any[]>([])
const comparisons = ref<any[]>([])
const draftGroups = ref<any[]>([])
const groupIdx = ref(0)
const saving = ref(false)
const loading = ref(false)
const errorMsg = ref('')

function emptyRow(): Row {
  return { product_id: '', candidate_id: null, name: '', qty_order: null, price: null }
}
const addRow = () => rows.value.push(emptyRow())
const removeRow = (i: number) => rows.value.splice(i, 1)

const rate = computed(() => (form.currency === 'IDR' ? 1 : form.exchange_rate ?? 0))
const lineIdr = (r: Row) => Math.round((r.price ?? 0) * rate.value * 100) / 100
const lineTotalIdr = (r: Row) => (r.qty_order ?? 0) * lineIdr(r)
const totalForeign = computed(() => rows.value.reduce((s, r) => s + (r.qty_order ?? 0) * (r.price ?? 0), 0))
const totalIdr = computed(() => rows.value.reduce((s, r) => s + lineTotalIdr(r), 0))

async function applyDraftGroup(i: number) {
  const g = draftGroups.value[i]
  if (!g) return
  groupIdx.value = i
  if (g.supplier_id) form.supplier_id = g.supplier_id
  form.currency = g.currency
  rows.value = g.items.map((it: any) => ({
    product_id: it.product_id,
    candidate_id: it.candidate_id,
    name: it.name,
    qty_order: it.qty_order,
    price: it.price,
  }))
}

async function loadFromComparison(cid: string) {
  errorMsg.value = ''
  try {
    const draft: any = await useApi(`/product-comparisons/${cid}/po-draft`)
    form.comparison_id = cid
    form.request_id = draft.request_id
    form.exchange_rate = draft.exchange_rate
    draftGroups.value = draft.groups
    await applyDraftGroup(0)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat data comparison'
  }
}

async function loadFromRequest(rid: string) {
  try {
    const r: any = await useApi(`/product-requests/${rid}`)
    form.request_id = rid
    rows.value = r.items.map((i: any) => ({
      product_id: i.product_id ?? '',
      candidate_id: null,
      name: i.name,
      qty_order: Number(i.qty),
      price: null,
    }))
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat request'
  }
}

async function onPickComparison(cid: string) {
  if (!cid) {
    form.comparison_id = ''
    draftGroups.value = []
    return
  }
  await loadFromComparison(cid)
}
async function onPickRequest(rid: string) {
  form.request_id = rid
  if (rid && !form.comparison_id) await loadFromRequest(rid)
}

onMounted(async () => {
  loading.value = true
  await loadMasters(['suppliers', 'warehouses', 'products'])
  const [rq, cp] = await Promise.all([useApi<any[]>('/product-requests'), useApi<any[]>('/product-comparisons')])
  requests.value = rq.filter((r) => ['approved', 'comparing', 'ordered'].includes(r.status))
  comparisons.value = cp

  try {
    if (props.id) {
      const po: any = await useApi(`/purchase-orders/${props.id}`)
      Object.assign(form, {
        supplier_id: po.supplier_id,
        warehouse_id: po.warehouse_id,
        order_date: po.order_date,
        currency: po.currency,
        exchange_rate: Number(po.exchange_rate),
        request_id: po.request_id ?? '',
        comparison_id: po.comparison_id ?? '',
        notes: po.notes ?? '',
      })
      rows.value = po.items.map((i: any) => ({
        product_id: i.product_id,
        candidate_id: i.candidate_id,
        name: '',
        qty_order: Number(i.qty_order),
        price: Number(po.currency === 'IDR' ? i.unit_price : i.price_foreign),
      }))
    } else if (route.query.comparison_id) {
      await loadFromComparison(route.query.comparison_id as string)
    } else if (route.query.request_id) {
      await loadFromRequest(route.query.request_id as string)
    }
  } finally {
    loading.value = false
  }
})

async function save(thenSubmit: boolean) {
  errorMsg.value = ''
  if (rows.value.some((r) => !r.product_id)) {
    errorMsg.value = 'Setiap item harus dipetakan ke produk master'
    return
  }
  if (form.currency === 'RMB' && !(form.exchange_rate && form.exchange_rate > 0)) {
    errorMsg.value = 'Isi kurs RMB → IDR'
    return
  }
  saving.value = true
  try {
    const body = {
      supplier_id: form.supplier_id,
      warehouse_id: form.warehouse_id,
      order_date: form.order_date,
      currency: form.currency,
      exchange_rate: form.currency === 'IDR' ? 1 : form.exchange_rate,
      request_id: form.request_id || null,
      comparison_id: form.comparison_id || null,
      notes: form.notes || null,
      items: rows.value.map((r) => ({
        product_id: r.product_id,
        candidate_id: r.candidate_id,
        qty_order: r.qty_order ?? 0,
        price: r.price ?? 0,
      })),
    }
    const saved: any = props.id
      ? await useApi(`/purchase-orders/${props.id}`, { method: 'PUT', body })
      : await useApi('/purchase-orders', { method: 'POST', body })
    if (thenSubmit) await useApi(`/purchase-orders/${saved.id}/submit`, { method: 'POST' })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: thenSubmit ? 'PO disimpan dan disubmit.' : 'PO disimpan sebagai draft.' })
    await router.push(`/purchase/orders/${saved.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menyimpan PO'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <form v-else @submit.prevent="save(false)">
      <section class="doc-card">
        <h2>Sumber (opsional)</h2>
        <div class="form-grid">
          <BaseSearchableSelect
            :model-value="form.request_id"
            label="Dari Product Request"
            :options="requests.map((r) => ({ value: r.id, label: `${r.no_request} — ${r.title}` }))"
            @update:model-value="onPickRequest"
          />
          <BaseSearchableSelect
            :model-value="form.comparison_id"
            label="Dari Product Comparison"
            :options="comparisons.map((c) => ({ value: c.id, label: `${c.no_comparison} — ${c.title}` }))"
            @update:model-value="onPickComparison"
          />
          <BaseSelect
            v-if="draftGroups.length > 1"
            :model-value="String(groupIdx)"
            label="Supplier dari comparison"
            :options="draftGroups.map((g, i) => ({ value: String(i), label: `${suppliers.find((s) => s.id === g.supplier_id)?.name ?? 'Tanpa supplier'} (${g.currency}, ${g.items.length} item)` }))"
            @update:model-value="(v) => applyDraftGroup(Number(v))"
          />
        </div>
        <p v-if="draftGroups.length > 1" class="muted small">Comparison ini punya pemenang dari beberapa supplier — satu PO dibuat per supplier.</p>
      </section>

      <section class="doc-card">
        <h2>Informasi PO</h2>
        <div class="form-grid">
          <BaseSearchableSelect v-model="form.supplier_id" label="Supplier" required :options="suppliers.map((s) => ({ value: s.id, label: s.name }))" />
          <BaseSearchableSelect v-model="form.warehouse_id" label="Warehouse Tujuan" required :options="warehouses.map((w) => ({ value: w.id, label: w.name }))" />
          <BaseDatePicker v-model="form.order_date" label="Tanggal Order" required />
          <BaseSelect v-model="form.currency" :clearable="false" label="Mata Uang" :options="[{ value: 'IDR', label: 'IDR (Rp)' }, { value: 'RMB', label: 'RMB (¥)' }]" />
          <BaseNumberInput v-if="form.currency === 'RMB'" v-model="form.exchange_rate" label="Kurs RMB → IDR" required />
        </div>
        <BaseTextarea v-model="form.notes" label="Catatan" :rows="2" />
      </section>

      <section class="doc-card">
        <h2>Item</h2>
        <div class="table-scroll">
          <table class="doc-table">
            <thead>
              <tr>
                <th style="min-width: 280px">Produk (master)</th>
                <th>Qty</th>
                <th>Harga {{ form.currency === 'RMB' ? '(¥)' : '(Rp)' }}</th>
                <th v-if="form.currency === 'RMB'" class="num">Harga (Rp)</th>
                <th class="num">Subtotal (Rp)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="i">
                <td>
                  <BaseAsyncSelect
                    v-model="r.product_id"
                    :model-label="productLabel(r.product_id)"
                    placeholder="Cari produk master…"
                    :fetch-options="fetchProductOptions"
                  />
                  <div v-if="r.name && !r.product_id" class="muted small">Dari request: “{{ r.name }}” — pilih padanannya di master.</div>
                </td>
                <td style="width: 130px"><BaseNumberInput v-model="r.qty_order" decimals="auto" required /></td>
                <td style="width: 160px"><BaseNumberInput v-model="r.price" required /></td>
                <td v-if="form.currency === 'RMB'" class="num idr">{{ formatNumber(lineIdr(r)) }}</td>
                <td class="num idr">{{ formatNumber(lineTotalIdr(r)) }}</td>
                <td><BaseButton variant="ghost" size="sm" :disabled="rows.length === 1" @click="removeRow(i)">Hapus</BaseButton></td>
              </tr>
            </tbody>
            <tfoot>
              <tr v-if="form.currency === 'RMB'">
                <td :colspan="3" class="num">Total (¥)</td>
                <td class="num">¥ {{ formatNumber(totalForeign) }}</td>
                <td colspan="2" />
              </tr>
              <tr>
                <td :colspan="form.currency === 'RMB' ? 4 : 2" class="num">Total (Rp)</td>
                <td class="num">Rp {{ formatNumber(totalIdr) }}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <BaseButton variant="secondary" size="sm" @click="addRow">+ Tambah Item</BaseButton>
      </section>

      <div class="doc-sticky-bar">
        <span class="grow muted">Total: <strong>Rp {{ formatNumber(totalIdr) }}</strong></span>
        <BaseButton variant="secondary" :disabled="saving" @click="router.back()">Batal</BaseButton>
        <BaseButton variant="secondary" type="submit" :loading="saving">Simpan Draft</BaseButton>
        <BaseButton :loading="saving" @click="save(true)">Simpan &amp; Submit</BaseButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.small { font-size: 12px; }
.table-scroll { overflow-x: auto; margin-bottom: 10px; }
.idr { padding-top: 14px; font-weight: 600; }
.grow { margin-right: auto; align-self: center; }
</style>
