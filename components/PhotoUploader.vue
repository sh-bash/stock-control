<script setup lang="ts">
// Multi-photo field: click-to-pick, drag & drop, or paste an image straight from
// the clipboard (focus the box, then Ctrl+V). Saved photos are listed from the
// server; new ones stay in `pending` until the parent saves the owner record
// and calls `uploadPending(ownerId)` (exposed below). When the owner already
// exists, new photos upload immediately.
import { useAuthStore } from '~/stores/auth'

const props = withDefaults(
  defineProps<{
    ownerType: string
    ownerId?: string | null
    photoIds?: string[]
    readonly?: boolean
  }>(),
  { ownerId: null, photoIds: () => [], readonly: false },
)
const emit = defineEmits<{ changed: [] }>()

const auth = useAuthStore()
const saved = ref<string[]>([...props.photoIds])
const pending = ref<{ file: File; url: string }[]>([])
const dragging = ref(false)
const busy = ref(false)
const errorMsg = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const preview = ref<string | null>(null)

watch(() => props.photoIds, (v) => { saved.value = [...v] })

const srcOf = (id: string) => `/api/v1/attachments/${id}/file?token=${auth.accessToken ?? ''}`

function addFiles(files: File[]) {
  errorMsg.value = ''
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      errorMsg.value = 'Hanya file gambar yang bisa ditambahkan'
      continue
    }
    pending.value.push({ file: f, url: URL.createObjectURL(f) })
  }
  if (props.ownerId && pending.value.length) void uploadPending(props.ownerId)
}

function onPaste(e: ClipboardEvent) {
  if (props.readonly) return
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
  if (files.length) {
    e.preventDefault()
    addFiles(files)
  }
}
function onDrop(e: DragEvent) {
  dragging.value = false
  if (props.readonly) return
  addFiles([...(e.dataTransfer?.files ?? [])])
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  addFiles([...(input.files ?? [])])
  input.value = ''
}

async function uploadPending(ownerId: string) {
  if (!pending.value.length) return
  busy.value = true
  errorMsg.value = ''
  try {
    const body = new FormData()
    body.append('owner_type', props.ownerType)
    body.append('owner_id', ownerId)
    for (const p of pending.value) body.append('file', p.file, p.file.name || 'pasted.png')
    const rows = await useApi<{ id: string }[]>('/attachments', { method: 'POST', body })
    saved.value.push(...rows.map((r) => r.id))
    pending.value.forEach((p) => URL.revokeObjectURL(p.url))
    pending.value = []
    emit('changed')
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal mengunggah foto'
  } finally {
    busy.value = false
  }
}

async function removeSaved(id: string) {
  try {
    await useApi(`/attachments/${id}`, { method: 'DELETE' })
    saved.value = saved.value.filter((x) => x !== id)
    emit('changed')
  } catch (err: any) {
    errorMsg.value = err?.data?.data?.message || 'Gagal menghapus foto'
  }
}
function removePending(i: number) {
  const [p] = pending.value.splice(i, 1)
  if (p) URL.revokeObjectURL(p.url)
}

defineExpose({ uploadPending, hasPending: () => pending.value.length > 0 })
</script>

<template>
  <div class="photo-uploader">
    <div class="thumbs">
      <div v-for="id in saved" :key="id" class="thumb">
        <img :src="srcOf(id)" alt="foto" loading="lazy" @click="preview = srcOf(id)" />
        <button v-if="!readonly" type="button" class="x" title="Hapus" @click="removeSaved(id)">×</button>
      </div>
      <div v-for="(p, i) in pending" :key="p.url" class="thumb is-pending">
        <img :src="p.url" alt="foto baru" @click="preview = p.url" />
        <button type="button" class="x" title="Batalkan" @click="removePending(i)">×</button>
        <span class="tag">belum disimpan</span>
      </div>
    </div>

    <div
      v-if="!readonly"
      class="dropzone"
      :class="{ dragging }"
      tabindex="0"
      @paste="onPaste"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
      @keydown.enter="fileInput?.click()"
    >
      <span v-if="busy">Mengunggah…</span>
      <span v-else>📋 Klik lalu <kbd>Ctrl</kbd>+<kbd>V</kbd> untuk paste, seret file, atau klik untuk memilih foto</span>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPick" />
    </div>
    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

    <div v-if="preview" class="lightbox" @click="preview = null">
      <img :src="preview" alt="preview" />
    </div>
  </div>
</template>

<style scoped>
.thumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.thumb { position: relative; width: 84px; height: 84px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--color-border); background: var(--color-bg); }
.thumb img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; display: block; }
.thumb.is-pending { border-style: dashed; border-color: var(--color-warning); }
.thumb .x { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; border: none; background: rgba(15, 23, 42, 0.7); color: #fff; cursor: pointer; line-height: 1; }
.thumb .tag { position: absolute; bottom: 0; left: 0; right: 0; font-size: 9px; text-align: center; background: var(--color-warning); color: #fff; }
.dropzone { border: 1.5px dashed var(--color-border); border-radius: var(--radius-md); padding: 12px; text-align: center; font-size: 12px; color: var(--color-text-muted); cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.dropzone:hover, .dropzone:focus, .dropzone.dragging { outline: none; border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--color-primary); }
kbd { background: var(--color-neutral-bg); border-radius: 4px; padding: 0 4px; font-size: 11px; }
.err { color: var(--color-danger); font-size: 12px; margin: 6px 0 0; }
.lightbox { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; cursor: zoom-out; }
.lightbox img { max-width: 90vw; max-height: 90vh; border-radius: var(--radius-md); }
</style>
