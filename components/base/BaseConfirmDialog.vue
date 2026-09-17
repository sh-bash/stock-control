<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    variant?: 'primary' | 'danger'
    loading?: boolean
  }>(),
  {
    title: 'Konfirmasi',
    message: 'Apakah Anda yakin?',
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
    variant: 'primary',
    loading: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [boolean]; confirm: []; cancel: [] }>()

function handleCancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <BaseModal :model-value="modelValue" size="sm" :title="title" :close-on-backdrop="!loading" :close-on-esc="!loading" @update:model-value="(v) => $emit('update:modelValue', v)">
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <BaseButton variant="secondary" :disabled="loading" @click="handleCancel">{{ cancelText }}</BaseButton>
      <BaseButton :variant="variant" :loading="loading" @click="handleConfirm">{{ confirmText }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-message {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.5;
}
</style>
