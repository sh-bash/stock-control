<script setup lang="ts">
// Two ways to use this component:
//  1. `tone` directly — for severity badges (notifications, low-stock alerts).
//  2. `status` — a document/entity status string (draft, approved, ...);
//     STATUS_TONE_MAP resolves it to the right tone so every page shows the
//     same status in the same color without redeclaring the mapping.
// Falls back to `neutral` for any status not in the map, rather than
// silently rendering unstyled.

const STATUS_TONE_MAP: Record<string, 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = {
  draft: 'neutral',
  waiting_approval: 'warning',
  pending: 'warning',
  approved: 'info',
  confirmed: 'info',
  rejected: 'danger',
  closed: 'success',
  completed: 'success',
  processed: 'success',
  active: 'success',
  exhausted: 'neutral',
  partial_received: 'info',
  partial_delivered: 'info',
  good: 'success',
  damaged: 'danger',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  fast: 'success',
  normal: 'info',
  slow: 'warning',
  dead: 'danger',
  success: 'success',
  failed: 'danger',
  inactive: 'neutral',
}

const props = withDefaults(
  defineProps<{
    status?: string | null
    tone?: 'danger' | 'warning' | 'success' | 'info' | 'neutral'
  }>(),
  { status: null, tone: undefined },
)

const resolvedTone = computed(() => {
  if (props.tone) return props.tone
  if (props.status) return STATUS_TONE_MAP[props.status] ?? 'neutral'
  return 'neutral'
})

const label = computed(() => props.status?.replace(/_/g, ' ') ?? '')
</script>

<template>
  <span class="base-badge" :class="`tone-${resolvedTone}`">
    <slot>{{ label }}</slot>
  </span>
</template>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  line-height: 1.6;
  white-space: nowrap;
}
.tone-danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
.tone-warning {
  background: var(--color-warning-bg);
  color: #b45309;
}
.tone-success {
  background: var(--color-normal-bg);
  color: var(--color-normal);
}
.tone-info {
  background: var(--color-info-bg);
  color: var(--color-info);
}
.tone-neutral {
  background: var(--color-neutral-bg);
  color: var(--color-text-muted);
}
</style>
