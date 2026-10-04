<script setup lang="ts">
// Warning banner for Purchase Return: every issue-flagged comment that anyone
// left on the receiving, its POs, or the product requests behind them.
const props = defineProps<{ receivingId: string }>()

interface Issue { id: string; ref_type: string; ref_id: string; ref_label: string | null; user_name: string; message: string; created_at: string }

const issues = ref<Issue[]>([])
const loaded = ref(false)

const LINK: Record<string, (id: string) => string> = {
  receiving: (id) => `/purchase/receivings/${id}`,
  po: (id) => `/purchase/orders/${id}`,
  request: (id) => `/purchase/requests/${id}`,
}
const TYPE_LABEL: Record<string, string> = { receiving: 'Receiving', po: 'Purchase Order', request: 'Request' }

async function load() {
  loaded.value = false
  issues.value = []
  if (!props.receivingId) return
  try {
    const res: any = await useApi('/purchase-returns/warnings', { query: { receiving_id: props.receivingId } })
    issues.value = res.issues
  } finally {
    loaded.value = true
  }
}
watch(() => props.receivingId, load)
onMounted(load)
</script>

<template>
  <section v-if="loaded && issues.length" class="warn" role="alert">
    <h3>⚠️ {{ issues.length }} catatan masalah terkait barang ini</h3>
    <p>Dilaporkan oleh tim pada Product Request, PO, atau Receiving yang terkait. Periksa sebelum membuat retur.</p>
    <ul>
      <li v-for="i in issues" :key="i.id">
        <div class="head">
          <NuxtLink :to="LINK[i.ref_type]?.(i.ref_id) ?? '#'" class="ref"><span class="type">{{ TYPE_LABEL[i.ref_type] }}</span> {{ i.ref_label }}</NuxtLink>
          <span class="who">{{ i.user_name }} · {{ new Date(i.created_at).toLocaleDateString('id-ID') }}</span>
        </div>
        <p class="msg">{{ i.message }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.warn { background: var(--color-warning-bg); border: 1px solid var(--color-warning); border-left-width: 5px; border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px; }
h3 { margin: 0 0 4px; font-size: 14px; color: #92400e; }
.warn > p { margin: 0 0 8px; font-size: 12px; color: #92400e; }
ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
li { background: var(--color-surface); border-radius: var(--radius-sm); padding: 8px 10px; }
.head { display: flex; gap: 10px; justify-content: space-between; font-size: 12px; }
.ref { font-weight: 600; color: var(--color-info); }
.type { font-weight: 400; color: var(--color-text-muted); text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; margin-right: 2px; }
.who { color: var(--color-text-muted); }
.msg { margin: 4px 0 0; font-size: 13px; white-space: pre-wrap; }
</style>
