<script setup lang="ts">
const { servers, connected } = useLive()
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <h1 class="text-xl font-semibold">Dashboard</h1>
      <div class="flex items-center gap-2">
        <UBadge
          :color="connected ? 'success' : 'neutral'"
          variant="subtle"
          size="sm"
          :icon="connected ? 'i-lucide-radio' : 'i-lucide-wifi-off'"
        >
          {{ connected ? 'Live' : 'Polling' }}
        </UBadge>
        <UButton to="/servers?add=1" color="neutral" variant="outline" size="sm" icon="i-lucide-plus">
          Add server
        </UButton>
      </div>
    </div>

    <div v-if="servers.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <UIcon name="i-lucide-server" class="size-12 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-1">No servers yet</h2>
      <p class="text-sm text-muted mb-4 max-w-md">
        Add a Strata engine by its base URL (e.g. <code>http://192.168.10.76:8000</code>) —
        metrics are read from <code>/metrics</code>.
      </p>
      <UButton to="/servers?add=1" icon="i-lucide-plus">Add your first server</UButton>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ServerCard v-for="server in servers" :key="server.id" :server="server" />
    </div>
  </div>
</template>
