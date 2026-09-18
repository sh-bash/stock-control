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

const showSuccess = ref(false)

function handleCancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm')
}

// Called by the parent after its confirm action succeeds, so the dialog
// shows a brief checkmark instead of just vanishing.
function playSuccessAndClose() {
  showSuccess.value = true
  setTimeout(() => {
    showSuccess.value = false
    emit('update:modelValue', false)
  }, 600)
}

defineExpose({ playSuccessAndClose })
</script>

<template>
  <BaseModal :model-value="modelValue" size="sm" :title="title" :close-on-backdrop="!loading" :close-on-esc="!loading" @update:model-value="(v) => $emit('update:modelValue', v)">
    <div v-if="showSuccess" class="confirm-success">
      <span class="checkmark">✓</span>
    </div>
    <p v-else class="confirm-message">{{ message }}</p>
    <template v-if="!showSuccess" #footer>
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
.confirm-success {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}
.checkmark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-normal-bg);
  color: var(--color-normal);
  font-size: 24px;
  font-weight: 700;
  animation: confirm-pop 300ms ease-out;
}
@keyframes confirm-pop {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
