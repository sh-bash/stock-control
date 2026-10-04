<script setup lang="ts">
// Discussion thread on a document. Comments marked "masalah" are surfaced as
// warnings on the Purchase Return page for everything in the same chain.
import { useAuthStore } from '~/stores/auth'

interface Comment { id: string; user_id: string; user_name: string; message: string; is_issue: boolean; created_at: string }

const props = defineProps<{ refType: 'request' | 'po' | 'receiving'; refId: string }>()

const auth = useAuthStore()
const items = ref<Comment[]>([])
const message = ref('')
const isIssue = ref(false)
const sending = ref(false)
const errorMsg = ref('')

async function load() {
  try {
    items.value = await useApi<Comment[]>('/comments', { query: { ref_type: props.refType, ref_id: props.refId } })
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal memuat komentar'
  }
}
async function send() {
  if (!message.value.trim()) return
  sending.value = true
  errorMsg.value = ''
  try {
    await useApi('/comments', {
      method: 'POST',
      body: { ref_type: props.refType, ref_id: props.refId, message: message.value, is_issue: isIssue.value },
    })
    message.value = ''
    isIssue.value = false
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal mengirim komentar'
  } finally {
    sending.value = false
  }
}
async function toggleIssue(c: Comment) {
  try {
    await useApi(`/comments/${c.id}`, { method: 'PUT', body: { is_issue: !c.is_issue } })
    await load()
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal mengubah komentar'
  }
}
const fmt = (s: string) => new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

watch(() => props.refId, load)
onMounted(load)
</script>

<template>
  <section class="comments card">
    <h3>Diskusi &amp; Catatan <span class="count">{{ items.length }}</span></h3>
    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
    <p v-if="!items.length" class="empty">Belum ada komentar.</p>
    <ul v-else>
      <li v-for="c in items" :key="c.id" :class="{ issue: c.is_issue }">
        <div class="meta">
          <strong>{{ c.user_name }}</strong>
          <span>{{ fmt(c.created_at) }}</span>
          <BaseBadge v-if="c.is_issue" status="danger">masalah</BaseBadge>
          <button v-if="c.user_id === auth.user?.id" class="link" @click="toggleIssue(c)">
            {{ c.is_issue ? 'Hapus tanda masalah' : 'Tandai masalah' }}
          </button>
        </div>
        <p class="msg">{{ c.message }}</p>
      </li>
    </ul>
    <div class="composer">
      <BaseTextarea v-model="message" placeholder="Tulis catatan atau laporkan masalah…" :rows="2" />
      <label class="issue-toggle"><input v-model="isIssue" type="checkbox" /> Tandai sebagai masalah (muncul sebagai peringatan di Purchase Return)</label>
      <BaseButton size="sm" :loading="sending" :disabled="!message.trim()" @click="send">Kirim</BaseButton>
    </div>
  </section>
</template>

<style scoped>
.card { background: var(--color-surface); border-radius: var(--radius-md); box-shadow: var(--elevation-1); padding: 16px; }
h3 { margin: 0 0 12px; font-size: 15px; }
.count { color: var(--color-text-muted); font-weight: 400; margin-left: 4px; }
ul { list-style: none; padding: 0; margin: 0 0 12px; display: grid; gap: 8px; }
li { border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 10px; }
li.issue { border-color: var(--color-danger); background: var(--color-danger-bg); }
.meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--color-text-muted); }
.meta strong { color: var(--color-text); }
.msg { margin: 4px 0 0; font-size: 13px; white-space: pre-wrap; }
.link { margin-left: auto; background: none; border: none; color: var(--color-info); cursor: pointer; font-size: 12px; }
.composer { display: grid; gap: 8px; justify-items: start; }
.issue-toggle { font-size: 12px; color: var(--color-text-muted); display: flex; gap: 6px; align-items: center; }
.empty { color: var(--color-text-muted); font-size: 13px; }
.err { color: var(--color-danger); font-size: 12px; }
</style>
