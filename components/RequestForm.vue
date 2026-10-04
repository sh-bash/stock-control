<script setup lang="ts">
// Create / edit form for a Product Request (separate page, not a modal).
const props = defineProps<{ id?: string }>()

interface Item { product_id: string | null; name: string; spec: string; qty: number | null; unit: string; notes: string }

const router = useRouter()
const notif = useNotificationStore()
const { loadMasters, productLabel, fetchProductOptions } = useMasters()

const form = ref({
  title: '',
  notes: '',
  needed_date: '' as string,
  needs_approval: true,
  items: [emptyItem()] as Item[],
})
const saving = ref(false)
const loading = ref(false)
const errorMsg = ref('')

function emptyItem(): Item {
  return { product_id: null, name: '', spec: '', qty: null, unit: '', notes: '' }
}
const addItem = () => form.value.items.push(emptyItem())
const removeItem = (i: number) => form.value.items.splice(i, 1)

async function onPickProduct(item: Item, productId: string, label: string) {
  item.product_id = productId || null
  // Pre-fill the name from the picked master product so the requester doesn't retype it.
  if (productId && !item.name) item.name = label.split(' - ').slice(1).join(' - ') || label
}

onMounted(async () => {
  await loadMasters(['products'])
  if (!props.id) return
  loading.value = true
  try {
    const r: any = await useApi(`/product-requests/${props.id}`)
    form.value = {
      title: r.title,
      notes: r.notes ?? '',
      needed_date: r.needed_date ?? '',
      needs_approval: r.needs_approval,
      items: r.items.map((i: any) => ({
        product_id: i.product_id,
        name: i.name,
        spec: i.spec ?? '',
        qty: Number(i.qty),
        unit: i.unit ?? '',
        notes: i.notes ?? '',
      })),
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat request'
  } finally {
    loading.value = false
  }
})

async function save(thenSubmit: boolean) {
  errorMsg.value = ''
  saving.value = true
  try {
    const body = {
      title: form.value.title,
      notes: form.value.notes || null,
      needed_date: form.value.needed_date || null,
      needs_approval: form.value.needs_approval,
      items: form.value.items.map((i) => ({
        product_id: i.product_id || null,
        name: i.name,
        spec: i.spec || null,
        qty: i.qty ?? 0,
        unit: i.unit || null,
        notes: i.notes || null,
      })),
    }
    const saved: any = props.id
      ? await useApi(`/product-requests/${props.id}`, { method: 'PUT', body })
      : await useApi('/product-requests', { method: 'POST', body })
    if (thenSubmit) await useApi(`/product-requests/${saved.id}/submit`, { method: 'POST' })
    notif.pushToast({
      severity: 'success',
      title: 'Berhasil',
      message: thenSubmit ? 'Request disimpan dan disubmit.' : 'Request disimpan sebagai draft.',
    })
    await router.push(`/purchase/requests/${saved.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menyimpan request'
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
        <h2>Informasi Request</h2>
        <div class="form-grid">
          <BaseInput v-model="form.title" label="Judul / Kebutuhan" required placeholder="mis. Lampu LED outdoor 50W" />
          <BaseDatePicker v-model="form.needed_date" label="Dibutuhkan Sebelum" />
        </div>
        <BaseTextarea v-model="form.notes" label="Catatan" :rows="2" />
        <label class="approval-flag">
          <input v-model="form.needs_approval" type="checkbox" />
          <span>
            <strong>Perlu persetujuan (approval)</strong>
            <small>
              {{ form.needs_approval
                ? 'Request harus disetujui dulu sebelum bisa dibandingkan / dibuatkan PO.'
                : 'Tidak perlu approval: setelah disubmit, request langsung bisa dipakai untuk Comparison / PO.' }}
            </small>
          </span>
        </label>
      </section>

      <section class="doc-card">
        <h2>Item yang Diminta</h2>
        <div class="items">
          <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
            <BaseInput v-model="item.name" label="Nama Produk" required />
            <BaseNumberInput v-model="item.qty" label="Qty" decimals="auto" required />
            <BaseInput v-model="item.unit" label="Satuan" placeholder="pcs, set, ..." />
            <BaseAsyncSelect
              :model-value="item.product_id ?? ''"
              :model-label="item.product_id ? productLabel(item.product_id) : ''"
              label="Sudah ada di master? (opsional)"
              placeholder="Cari produk master…"
              :fetch-options="fetchProductOptions"
              @update:model-value="(v) => (item.product_id = v || null)"
              @update:model-label="(l) => onPickProduct(item, item.product_id ?? '', l)"
            />
            <BaseInput v-model="item.spec" label="Spesifikasi" placeholder="warna, ukuran, bahan…" />
            <BaseInput v-model="item.notes" label="Catatan" />
            <BaseButton variant="ghost" size="sm" :disabled="form.items.length === 1" @click="removeItem(idx)">Hapus</BaseButton>
          </div>
        </div>
        <BaseButton variant="secondary" size="sm" @click="addItem">+ Tambah Item</BaseButton>
      </section>

      <div class="doc-sticky-bar">
        <BaseButton variant="secondary" :disabled="saving" @click="router.back()">Batal</BaseButton>
        <BaseButton variant="secondary" type="submit" :loading="saving">Simpan Draft</BaseButton>
        <BaseButton :loading="saving" @click="save(true)">Simpan &amp; Submit</BaseButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.approval-flag { display: flex; gap: 10px; align-items: flex-start; margin-top: 12px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; }
.approval-flag input { margin-top: 3px; }
.approval-flag span { display: grid; gap: 2px; font-size: 13px; }
.approval-flag small { color: var(--color-text-muted); }
.items { display: grid; gap: 10px; margin-bottom: 12px; }
.item-row { display: grid; grid-template-columns: 2fr 0.8fr 0.8fr 2fr 2fr 2fr auto; gap: 10px; align-items: end; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
@media (max-width: 1200px) { .item-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
