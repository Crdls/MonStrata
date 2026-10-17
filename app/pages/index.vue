<script setup lang="ts">
const { servers, connected, ready } = useLive()
const { t } = useI18n()
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <h1 class="text-xl font-semibold">{{ t('dashboard.title') }}</h1>
      <div class="flex items-center gap-2">
        <UBadge
          :color="connected ? 'success' : 'neutral'"
          variant="subtle"
          size="sm"
          :icon="connected ? 'i-lucide-radio' : 'i-lucide-wifi-off'"
        >
          {{ connected ? t('common.live') : t('common.polling') }}
        </UBadge>
        <UButton to="/servers?add=1" color="neutral" variant="outline" size="sm" icon="i-lucide-plus">
          {{ t('common.addServer') }}
        </UButton>
      </div>
    </div>

    <div v-if="!ready" class="flex items-center justify-center py-20">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="servers.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <UIcon name="i-lucide-server" class="size-12 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-1">{{ t('dashboard.emptyTitle') }}</h2>
      <p class="text-sm text-muted mb-4 max-w-md">
        {{ t('dashboard.emptyText') }}
      </p>
      <UButton to="/servers?add=1" icon="i-lucide-plus">{{ t('dashboard.cta') }}</UButton>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ServerCard v-for="server in servers" :key="server.id" :server="server" />
    </div>
  </div>
</template>
