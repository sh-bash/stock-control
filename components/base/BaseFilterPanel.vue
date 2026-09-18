<script setup lang="ts">
// Collapsible (default) or inline filter bar shared by every list page.
// The page owns filter *values* (via useTableFilters) and chip *labels*
// (it's the only one that can turn e.g. a warehouse_id into a name) — this
// component only handles the show/hide chrome and the chip/reset row.
export interface FilterChip {
  key: string
  label: string
}

withDefaults(
  defineProps<{
    chips: readonly FilterChip[]
    activeCount?: number
    inline?: boolean
  }>(),
  { activeCount: 0, inline: false },
)

const emit = defineEmits<{ 'remove-chip': [string]; reset: [] }>()

const open = ref(false)
</script>

<template>
  <div class="filter-panel">
    <div class="filter-panel-bar">
      <button v-if="!inline" type="button" class="filter-toggle" @click="open = !open">
        <span>Filter</span>
        <span v-if="activeCount > 0" class="filter-count">{{ activeCount }}</span>
        <span class="filter-chevron" :class="{ open }">▾</span>
      </button>
      <div v-if="chips.length > 0" class="filter-chips">
        <span v-for="chip in chips" :key="chip.key" class="filter-chip">
          {{ chip.label }}
          <button type="button" aria-label="Hapus filter" @click="$emit('remove-chip', chip.key)">×</button>
        </span>
        <button type="button" class="filter-reset" @click="$emit('reset')">Reset semua filter</button>
      </div>
    </div>
    <div v-show="inline || open" class="filter-panel-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.filter-panel {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-1);
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
}
.filter-panel-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  transition: all 150ms ease-in-out;
  flex-shrink: 0;
}
.filter-toggle:hover {
  border-color: var(--color-primary);
}
.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
}
.filter-chevron {
  transition: transform 150ms ease-in-out;
  font-size: 10px;
}
.filter-chevron.open {
  transform: rotate(180deg);
}
.filter-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: 999px;
  padding: 3px 6px 3px 10px;
  font-size: 12px;
  font-weight: 600;
}
.filter-chip button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.filter-reset {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
  padding: 3px 4px;
}
.filter-panel-body {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-neutral-bg);
}
.filter-panel-body > :deep(*) {
  min-width: 180px;
  flex: 1 1 180px;
}
</style>
