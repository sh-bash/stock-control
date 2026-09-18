<script setup lang="ts">
export interface BreadcrumbItem {
  label: string
  to?: string
}

defineProps<{ items: readonly BreadcrumbItem[] }>()
</script>

<template>
  <nav class="base-breadcrumb" aria-label="Breadcrumb">
    <template v-for="(item, i) in items" :key="i">
      <NuxtLink v-if="item.to && i < items.length - 1" :to="item.to" class="crumb-link">{{ item.label }}</NuxtLink>
      <span v-else class="crumb-current">{{ item.label }}</span>
      <span v-if="i < items.length - 1" class="crumb-sep">/</span>
    </template>
  </nav>
</template>

<style scoped>
.base-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font: var(--text-caption);
  margin-bottom: 8px;
}
.crumb-link {
  color: var(--color-text-muted);
  text-decoration: none;
}
.crumb-link:hover {
  color: var(--color-primary);
  text-decoration: underline;
}
.crumb-current {
  color: var(--color-text);
  font-weight: 600;
}
.crumb-sep {
  color: var(--color-border);
}
</style>
