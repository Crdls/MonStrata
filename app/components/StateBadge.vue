<script setup lang="ts">
import type { LiveServer } from '../plugins/live'

const props = defineProps<{ server: LiveServer }>()

const STATES: Record<string, { label: string, color: string, icon: string }> = {
  unloaded: { label: 'Unloaded', color: 'neutral', icon: 'i-lucide-circle-dashed' },
  idle: { label: 'Idle', color: 'info', icon: 'i-lucide-pause' },
  reading: { label: 'Reading', color: 'warning', icon: 'i-lucide-download' },
  generating: { label: 'Generating', color: 'success', icon: 'i-lucide-zap' }
}

const state = computed(() => {
  const snap = props.server.snapshot
  if (!snap || !snap.up) return null
  const entries = snap.metrics['strata:live_state'] ?? []
  const active = entries.find(([, v]) => v === 1)
  return active ? STATES[parseState(active[0])] ?? null : null
})

function parseState (labels: string): string {
  const m = /(?:^|,)state=([^,]+)/.exec(labels)
  return m?.[1] ?? ''
}
</script>

<template>
  <UBadge
    v-if="!server.enabled"
    color="neutral"
    variant="subtle"
    icon="i-lucide-ban"
    size="sm"
  >
    Disabled
  </UBadge>
  <UBadge
    v-else-if="state"
    :color="state.color as any"
    variant="subtle"
    :icon="state.icon"
    size="sm"
  >
    {{ state.label }}
  </UBadge>
  <UBadge
    v-else
    color="error"
    variant="subtle"
    icon="i-lucide-plug-zap"
    size="sm"
  >
    Down
  </UBadge>
</template>
