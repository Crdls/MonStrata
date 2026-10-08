<script setup lang="ts">
import type { ChartSeries } from '../../components/MetricChart.vue'
import { seriesName } from '../../utils/format'

const route = useRoute()
const id = computed(() => Number(route.params.id))

const RANGES = [
  { label: '1h', ms: 3_600_000 },
  { label: '6h', ms: 6 * 3_600_000 },
  { label: '24h', ms: 24 * 3_600_000 },
  { label: '7d', ms: 7 * 86_400_000 },
  { label: '30d', ms: 30 * 86_400_000 }
]
const rangeIdx = ref(0)

const CHARTS: Array<{ title: string, keys: string[], unit: string, scale?: number }> = [
  { title: 'GPU util', keys: ['strata:gpu_util'], unit: '%' },
  { title: 'GPU memory', keys: ['derived:gpu_mem_pct'], unit: '%' },
  { title: 'GPU temperature', keys: ['strata:gpu_temp_celsius'], unit: '°C' },
  { title: 'GPU power', keys: ['strata:gpu_power_watts'], unit: 'W' },
  { title: 'Throughput', keys: ['strata:live_tok_s', 'derived:gen_tok_s', 'derived:prompt_tok_s'], unit: 'tok/s' },
  { title: 'Requests', keys: ['vllm:num_requests_running', 'vllm:num_requests_waiting'], unit: '' },
  { title: 'Request rate', keys: ['derived:req_s'], unit: 'req/s' },
  { title: 'Latency (window avg)', keys: ['derived:ttft_avg_s', 'derived:itl_avg_s', 'derived:e2e_avg_s'], unit: 's' },
  { title: 'KV cache', keys: ['vllm:kv_cache_usage_perc'], unit: '%', scale: 100 },
  { title: 'Expert cache hit rate', keys: ['strata:last_hit_rate'], unit: '%', scale: 100 },
  { title: 'Host load', keys: ['strata:cpu', 'derived:ram_pct'], unit: '%' },
  { title: 'Engine busy', keys: ['derived:decode_busy_pct', 'derived:prefill_busy_pct'], unit: '%' }
]

interface ChartState {
  title: string
  unit: string
  scale: number
  series: ChartSeries[]
  loading: boolean
}

const charts = ref<ChartState[]>(CHARTS.map(c => ({ title: c.title, unit: c.unit, scale: c.scale ?? 1, series: [], loading: true })))

const { servers } = useLive()
const server = computed(() => servers.value.find(s => s.id === id.value) ?? null)

async function load () {
  const to = Date.now()
  const from = to - RANGES[rangeIdx.value]!.ms
  charts.value = await Promise.all(CHARTS.map(async (c, i) => {
    const perKey = await Promise.all(c.keys.map(async (key) => {
      try {
        const res = await $fetch<{ label: string, series: Array<{ labels: string, points: Array<[number, number]> }> }>(
          '/api/range',
          { query: { serverId: id.value, metric: key, from, to } }
        )
        const multi = res.series.length > 1
        return res.series.map(s => ({
          name: multi ? seriesName(res.label, s.labels) : res.label,
          points: s.points
        }))
      } catch {
        return [] as ChartSeries[]
      }
    }))
    return { title: c.title, unit: c.unit, scale: c.scale ?? 1, series: perKey.flat(), loading: false }
  }))
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void load()
  timer = setInterval(load, 30_000)
})
watch(rangeIdx, load)
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="flex items-center gap-3 min-w-0">
        <UButton to="/" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-semibold truncate">
              {{ server?.name ?? `Server #${id}` }}
            </h1>
            <StateBadge v-if="server" :server="server" />
          </div>
          <div class="text-xs text-muted truncate">{{ server?.url }}</div>
        </div>
      </div>
      <div class="flex items-center gap-1 rounded-lg border border-default p-1">
        <UButton
          v-for="(r, i) in RANGES"
          :key="r.label"
          size="xs"
          :variant="rangeIdx === i ? 'solid' : 'ghost'"
          :color="rangeIdx === i ? 'primary' : 'neutral'"
          @click="rangeIdx = i"
        >
          {{ r.label }}
        </UButton>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <ClientOnly v-for="chart in charts" :key="chart.title">
        <MetricChart
          :title="chart.title"
          :series="chart.series"
          :unit="chart.unit"
          :scale="chart.scale"
        />
        <template #fallback>
          <UCard>
            <div class="h-48 flex items-center justify-center text-sm text-muted">
              {{ chart.title }}
            </div>
          </UCard>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
