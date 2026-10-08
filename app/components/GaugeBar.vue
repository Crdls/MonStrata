<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number | null
  max?: number
  label?: string
  right?: string
}>(), { max: 100 })

const pct = computed(() => {
  if (props.value === null || !Number.isFinite(props.value)) return 0
  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})

const barColor = computed(() => {
  if (pct.value < 60) return 'bg-emerald-500'
  if (pct.value < 85) return 'bg-amber-500'
  return 'bg-red-500'
})
</script>

<template>
  <div class="space-y-0.5">
    <div v-if="label || right" class="flex items-baseline justify-between text-xs">
      <span class="text-muted truncate">{{ label }}</span>
      <span class="tabular-nums text-default">{{ right }}</span>
    </div>
    <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="barColor"
        :style="{ width: `${pct}%` }"
      />
    </div>
  </div>
</template>
