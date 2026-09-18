<script setup lang="ts">
// Visual stand-in for approval progress. `totalSteps` is optional because
// callers often only have `current_step` from the approval instance without
// a joined workflow definition — in that case we just show the current step
// plus a couple of look-ahead placeholders instead of a fixed-length track.
const props = withDefaults(
  defineProps<{
    currentStep: number
    totalSteps?: number | null
    rejected?: boolean
  }>(),
  { totalSteps: null, rejected: false },
)

const steps = computed(() => {
  const total = props.totalSteps ?? Math.max(props.currentStep + 1, 2)
  return Array.from({ length: total }, (_, i) => i + 1)
})
</script>

<template>
  <div class="approval-stepper">
    <div v-for="step in steps" :key="step" class="stepper-step">
      <span
        class="stepper-dot"
        :class="{
          done: step < currentStep,
          current: step === currentStep && !rejected,
          rejected: step === currentStep && rejected,
        }"
      >
        <template v-if="step < currentStep">✓</template>
        <template v-else-if="step === currentStep && rejected">✕</template>
        <template v-else>{{ step }}</template>
      </span>
      <span v-if="step < steps.length" class="stepper-line" :class="{ done: step < currentStep }" />
    </div>
  </div>
</template>

<style scoped>
.approval-stepper {
  display: inline-flex;
  align-items: center;
}
.stepper-step {
  display: inline-flex;
  align-items: center;
}
.stepper-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  background: var(--color-neutral-bg);
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.stepper-dot.done {
  background: var(--color-normal);
  color: #fff;
}
.stepper-dot.current {
  background: var(--color-primary);
  color: #fff;
}
.stepper-dot.rejected {
  background: var(--color-danger);
  color: #fff;
}
.stepper-line {
  width: 18px;
  height: 2px;
  background: var(--color-neutral-bg);
}
.stepper-line.done {
  background: var(--color-normal);
}
</style>
