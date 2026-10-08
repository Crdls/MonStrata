<script setup lang="ts">
import type { HeatmapData } from '../components/LoadHeatmap.vue'

const { t, te } = useI18n()

const period = ref('24h')
const metric = ref('strata:gpu_util')

const { data, pending, error } = await useFetch<HeatmapData>('/api/heatmap', {
  query: { period, metric },
  watch: [period, metric]
})

const periodItems = computed(() => [
  { label: t('heatmap.period24h'), value: '24h' },
  { label: t('heatmap.period7d'), value: '7d' },
  { label: t('heatmap.period30d'), value: '30d' },
  { label: t('heatmap.period1y'), value: '1y' }
])

const metricItems = computed(() =>
  (data.value?.availableMetrics ?? []).map(m => ({
    label: te(`metric.${m.value}`) ? t(`metric.${m.value}`) : (m.unit ? `${m.label} (${m.unit})` : m.label),
    value: m.value
  }))
)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl font-semibold">{{ t('heatmap.title') }}</h1>
        <p class="text-sm text-muted mt-0.5">
          {{ t('heatmap.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <USelect v-model="metric" :items="metricItems" class="w-56" size="sm" />
        <USelect v-model="period" :items="periodItems" class="w-40" size="sm" />
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('heatmap.errorTitle')"
      :description="String(error.statusMessage ?? error)"
      class="mb-4"
    />

    <UCard>
      <div v-if="pending && !data" class="h-40 flex items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>
      <LoadHeatmap v-else-if="data && data.rows.length" :data="data" />
      <div v-else class="py-12 text-center text-sm text-muted">
        {{ t('heatmap.empty') }}
      </div>
    </UCard>
  </div>
</template>
