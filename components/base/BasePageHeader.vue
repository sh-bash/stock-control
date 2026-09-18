<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string | null
    count?: number | null
  }>(),
  { description: null, count: null },
)
</script>

<template>
  <div class="base-page-header">
    <div class="header-text">
      <h1 class="page-title">
        {{ title }}
        <span v-if="count !== null" class="page-count">({{ count }})</span>
      </h1>
      <p v-if="description" class="page-description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.base-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
}
.page-title {
  font: var(--text-page-title);
  color: var(--color-text);
  margin: 0;
}
.page-count {
  font-weight: 400;
  color: var(--color-text-muted);
}
.page-description {
  margin: 4px 0 0;
  font: var(--text-body);
  color: var(--color-text-muted);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
</style>
