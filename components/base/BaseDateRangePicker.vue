<script setup lang="ts">
withDefaults(
  defineProps<{
    from: string
    to: string
    label?: string
  }>(),
  { label: 'Range Tanggal' },
)

const emit = defineEmits<{ 'update:from': [string]; 'update:to': [string] }>()

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

function applyPreset(preset: 'today' | 7 | 30 | 'month' | 'last-month') {
  const now = new Date()
  let from: Date
  let to = now
  if (preset === 'today') {
    from = now
  } else if (preset === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (preset === 'last-month') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    to = new Date(now.getFullYear(), now.getMonth(), 0)
  } else {
    from = new Date(now)
    from.setDate(from.getDate() - (preset - 1))
  }
  emit('update:from', fmt(from))
  emit('update:to', fmt(to))
}
</script>

<template>
  <div class="base-field date-range-field">
    <label v-if="label" class="base-field-label">{{ label }}</label>
    <div class="date-range-presets">
      <button type="button" @click="applyPreset('today')">Hari ini</button>
      <button type="button" @click="applyPreset(7)">7 hari</button>
      <button type="button" @click="applyPreset(30)">30 hari</button>
      <button type="button" @click="applyPreset('month')">Bulan ini</button>
      <button type="button" @click="applyPreset('last-month')">Bulan lalu</button>
    </div>
    <div class="date-range-inputs" title="Custom range">
      <input
        type="date"
        class="base-field-control"
        :value="from"
        @input="$emit('update:from', ($event.target as HTMLInputElement).value)"
      />
      <span class="date-range-sep">–</span>
      <input
        type="date"
        class="base-field-control"
        :value="to"
        @input="$emit('update:to', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<style scoped>
.date-range-field {
  min-width: 260px;
}
.date-range-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}
.date-range-presets button {
  background: var(--color-neutral-bg);
  border: none;
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  font-size: 11px;
  color: var(--color-text);
  cursor: pointer;
  transition: background-color 150ms ease-in-out;
}
.date-range-presets button:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}
.date-range-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}
.date-range-sep {
  color: var(--color-text-muted);
}
</style>
