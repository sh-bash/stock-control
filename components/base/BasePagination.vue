<script setup lang="ts">
const props = defineProps<{
  page: number
  pageSize: number
  totalRows: number
}>()

const emit = defineEmits<{ 'update:page': [number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalRows / props.pageSize)))

const rangeStart = computed(() => (props.totalRows === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.totalRows))

// Windowed page numbers (current ± 2), always including first/last with
// "…" gaps — keeps the control usable even with hundreds of pages
// (relevant for stock_ledger-backed tables).
const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = props.page
  const window = 2
  const pages = new Set<number>([1, total])
  for (let p = current - window; p <= current + window; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  return [...pages].sort((a, b) => a - b)
})

function goTo(p: number) {
  if (p < 1 || p > totalPages.value || p === props.page) return
  emit('update:page', p)
}

const jumpValue = ref('')
function jump() {
  const p = Number(jumpValue.value)
  if (Number.isInteger(p)) goTo(p)
  jumpValue.value = ''
}
</script>

<template>
  <div class="base-pagination">
    <span class="pagination-info">
      Menampilkan {{ rangeStart }}-{{ rangeEnd }} dari {{ totalRows }}
    </span>
    <div class="pagination-controls">
      <button class="page-btn" :disabled="page <= 1" @click="goTo(page - 1)">‹ Prev</button>
      <template v-for="(p, idx) in pageNumbers" :key="p">
        <span v-if="idx > 0 && p - pageNumbers[idx - 1] > 1" class="ellipsis">…</span>
        <button class="page-btn" :class="{ active: p === page }" @click="goTo(p)">{{ p }}</button>
      </template>
      <button class="page-btn" :disabled="page >= totalPages" @click="goTo(page + 1)">Next ›</button>
      <form class="jump-form" @submit.prevent="jump">
        <input v-model="jumpValue" type="number" min="1" :max="totalPages" placeholder="Ke..." />
      </form>
    </div>
  </div>
</template>

<style scoped>
.base-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 4px;
  font-size: 13px;
  color: var(--color-text-muted);
}
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}
.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text);
}
.page-btn.active {
  background: var(--color-info);
  border-color: var(--color-info);
  color: #fff;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ellipsis {
  padding: 0 4px;
}
.jump-form input {
  width: 56px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  margin-left: 4px;
}
</style>
