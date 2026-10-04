<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const notif = useNotificationStore()

interface Req { id: string; no_request: string; title: string; status: string }

const requests = ref<Req[]>([])
const form = reactive({
  request_id: (route.query.request_id as string) || '',
  title: '',
  notes: '',
  exchange_rate: null as number | null,
})
const saving = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  const all = await useApi<Req[]>('/product-requests')
  requests.value = all.filter((r) => ['approved', 'comparing'].includes(r.status))
  const preset = requests.value.find((r) => r.id === form.request_id)
  if (preset && !form.title) form.title = `Comparison ${preset.title}`
})

function onRequestChange(id: string) {
  form.request_id = id
  const r = requests.value.find((x) => x.id === id)
  if (r && !form.title) form.title = `Comparison ${r.title}`
}

async function save() {
  errorMsg.value = ''
  if (!form.request_id) {
    errorMsg.value = 'Pilih product request terlebih dahulu'
    return
  }
  saving.value = true
  try {
    const cmp: any = await useApi('/product-comparisons', {
      method: 'POST',
      body: { request_id: form.request_id, title: form.title, notes: form.notes || null, exchange_rate: form.exchange_rate ?? 1 },
    })
    notif.pushToast({ severity: 'success', title: 'Berhasil', message: 'Comparison dibuat. Tambahkan kandidat di bawah.' })
    await router.push(`/purchase/comparisons/${cmp.id}`)
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal membuat comparison'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Product Comparison', to: '/purchase/comparisons' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Product Comparison" description="Comparison selalu berasal dari Product Request yang sudah disetujui." />
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <form class="doc-card" @submit.prevent="save">
      <div class="form-grid">
        <BaseSearchableSelect
          :model-value="form.request_id"
          label="Product Request"
          required
          :options="requests.map((r) => ({ value: r.id, label: `${r.no_request} — ${r.title}` }))"
          @update:model-value="onRequestChange"
        />
        <BaseInput v-model="form.title" label="Judul Comparison" required />
        <BaseNumberInput v-model="form.exchange_rate" label="Kurs RMB → IDR" helper-text="Dipakai untuk menyamakan harga RMB ke Rupiah saat dibandingkan" />
      </div>
      <BaseTextarea v-model="form.notes" label="Catatan" :rows="2" />
      <div class="doc-actions" style="margin-top: 12px">
        <NuxtLink to="/purchase/comparisons"><BaseButton variant="secondary">Batal</BaseButton></NuxtLink>
        <BaseButton type="submit" :loading="saving">Buat Comparison</BaseButton>
      </div>
    </form>
  </div>
</template>
