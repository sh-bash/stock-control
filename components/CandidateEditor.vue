<script setup lang="ts">
// One candidate (a supplier's offer for a requested item) in a Product
// Comparison: price/currency, weight, dimensions, notes and photos.
// A brand-new candidate (no `candidate` prop) is created on first save; its
// pasted photos are uploaded right after the record exists.
const props = defineProps<{
  comparisonId: string
  candidate?: any | null
  requestItems: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  defaultRequestItemId?: string | null
  locked?: boolean
}>()
const emit = defineEmits<{ saved: [id: string]; removed: []; cancel: [] }>()

const notif = useNotificationStore()
const swal = useSwal()
const photos = ref<{ uploadPending: (id: string) => Promise<void>; hasPending: () => boolean } | null>(null)

const num = (v: any) => (v == null || v === '' ? null : Number(v))
const f = reactive({
  request_item_id: props.candidate?.request_item_id ?? props.defaultRequestItemId ?? '',
  supplier_id: props.candidate?.supplier_id ?? '',
  name: props.candidate?.name ?? '',
  price: num(props.candidate?.price) as number | null,
  currency: (props.candidate?.currency ?? 'RMB') as 'RMB' | 'IDR',
  moq: num(props.candidate?.moq),
  lead_time_days: num(props.candidate?.lead_time_days),
  weight_kg: num(props.candidate?.weight_kg),
  length_cm: num(props.candidate?.length_cm),
  width_cm: num(props.candidate?.width_cm),
  height_cm: num(props.candidate?.height_cm),
  pack_length_cm: num(props.candidate?.pack_length_cm),
  pack_width_cm: num(props.candidate?.pack_width_cm),
  pack_height_cm: num(props.candidate?.pack_height_cm),
  notes: props.candidate?.notes ?? '',
})
const saving = ref(false)
const errorMsg = ref('')
const isNew = computed(() => !props.candidate)
const promoted = computed(() => !!props.candidate?.promoted_product_id)

async function save() {
  errorMsg.value = ''
  if (!f.name.trim() || f.price == null) {
    errorMsg.value = 'Nama dan harga wajib diisi'
    return
  }
  saving.value = true
  try {
    const body = {
      request_item_id: f.request_item_id || null,
      supplier_id: f.supplier_id || null,
      name: f.name,
      price: f.price,
      currency: f.currency,
      moq: f.moq,
      lead_time_days: f.lead_time_days,
      weight_kg: f.weight_kg,
      length_cm: f.length_cm,
      width_cm: f.width_cm,
      height_cm: f.height_cm,
      pack_length_cm: f.pack_length_cm,
      pack_width_cm: f.pack_width_cm,
      pack_height_cm: f.pack_height_cm,
      notes: f.notes || null,
    }
    const row: any = isNew.value
      ? await useApi(`/product-comparisons/${props.comparisonId}/candidates`, { method: 'POST', body })
      : await useApi(`/comparison-candidates/${props.candidate.id}`, { method: 'PUT', body })
    await photos.value?.uploadPending(row.id)
    notif.pushToast({ severity: 'success', title: 'Tersimpan', message: `Kandidat "${f.name}" disimpan.` })
    emit('saved', row.id)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menyimpan kandidat'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!(await swal.confirmDelete(props.candidate.name))) return
  try {
    await useApi(`/comparison-candidates/${props.candidate.id}`, { method: 'DELETE' })
    emit('removed')
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus kandidat'
  }
}
</script>

<template>
  <div class="cand">
    <header>
      <strong>{{ isNew ? 'Kandidat baru' : candidate.name }}</strong>
      <BaseBadge v-if="promoted" status="success">sudah jadi master</BaseBadge>
    </header>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <div class="grid2">
      <BaseSearchableSelect
        v-model="f.request_item_id"
        label="Untuk item request"
        :options="requestItems.map((r) => ({ value: r.id, label: r.name }))"
      />
      <BaseSearchableSelect
        v-model="f.supplier_id"
        label="Supplier"
        :options="suppliers.map((s) => ({ value: s.id, label: s.name }))"
      />
    </div>
    <BaseInput v-model="f.name" label="Nama / Model Produk" required :disabled="locked" />

    <div class="grid3">
      <BaseNumberInput v-model="f.price" label="Harga" required :disabled="locked" />
      <BaseSelect v-model="f.currency" :clearable="false" label="Mata uang" :options="[{ value: 'RMB', label: 'RMB (¥)' }, { value: 'IDR', label: 'IDR (Rp)' }]" :disabled="locked" />
      <BaseNumberInput v-model="f.moq" label="MOQ" decimals="auto" :disabled="locked" />
    </div>

    <div class="grid3">
      <BaseNumberInput v-model="f.weight_kg" label="Berat (kg)" :decimals="3" :disabled="locked" />
      <BaseNumberInput v-model="f.lead_time_days" label="Lead time (hari)" :decimals="0" :disabled="locked" />
    </div>

    <fieldset>
      <legend>Dimensi Produk (cm) — P × L × T</legend>
      <div class="grid3">
        <BaseNumberInput v-model="f.length_cm" placeholder="Panjang" :disabled="locked" />
        <BaseNumberInput v-model="f.width_cm" placeholder="Lebar" :disabled="locked" />
        <BaseNumberInput v-model="f.height_cm" placeholder="Tinggi" :disabled="locked" />
      </div>
    </fieldset>
    <fieldset>
      <legend>Dimensi Kemasan (cm) — P × L × T</legend>
      <div class="grid3">
        <BaseNumberInput v-model="f.pack_length_cm" placeholder="Panjang" :disabled="locked" />
        <BaseNumberInput v-model="f.pack_width_cm" placeholder="Lebar" :disabled="locked" />
        <BaseNumberInput v-model="f.pack_height_cm" placeholder="Tinggi" :disabled="locked" />
      </div>
    </fieldset>

    <BaseTextarea v-model="f.notes" label="Catatan" :rows="2" :disabled="locked" />

    <div class="photos">
      <label>Foto Produk</label>
      <PhotoUploader
        ref="photos"
        owner-type="candidate"
        :owner-id="candidate?.id ?? null"
        :photo-ids="candidate?.photo_ids ?? []"
        :readonly="locked"
        @changed="candidate && emit('saved', candidate.id)"
      />
    </div>

    <footer v-if="!locked">
      <BaseButton v-if="!isNew" variant="danger" size="sm" :disabled="promoted" @click="remove">Hapus</BaseButton>
      <span class="grow" />
      <BaseButton v-if="isNew" variant="secondary" size="sm" @click="emit('cancel')">Batal</BaseButton>
      <BaseButton size="sm" :loading="saving" @click="save">{{ isNew ? 'Tambah Kandidat' : 'Simpan' }}</BaseButton>
    </footer>
  </div>
</template>

<style scoped>
.cand { display: grid; gap: 10px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; }
header { display: flex; gap: 8px; align-items: center; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
fieldset { border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 10px 10px; margin: 0; }
legend { font-size: 11px; color: var(--color-text-muted); padding: 0 4px; }
.photos label { font-size: 12px; color: var(--color-text-muted); display: block; margin-bottom: 4px; }
footer { display: flex; gap: 8px; align-items: center; }
.grow { flex: 1; }
</style>
