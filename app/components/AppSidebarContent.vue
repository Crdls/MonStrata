<script setup lang="ts">
// emitted on any action that should also close the mobile slideover
const emit = defineEmits<{ dismiss: [] }>()

const route = useRoute()
const { status, isAdmin, signOut } = useAuth()
const { connected } = useLive()
const { status: updateStatus } = useUpdate()
const authUser = computed(() => (status.value?.authEnabled ? status.value.user : null))
const { t } = useI18n()

const versionLabel = computed(() => (updateStatus.value ? shortVersion(updateStatus.value.currentSha) : ''))

// the user table is only listed for admins while auth is on
const nav = computed(() => [
  { to: '/', icon: 'i-lucide-layout-dashboard', label: 'nav.dashboard' },
  { to: '/heatmap', icon: 'i-lucide-grid-3x3', label: 'nav.heatmap' },
  { to: '/servers', icon: 'i-lucide-server', label: 'nav.servers' },
  // gateway clients work with auth off too (trusted LAN), so the page is only
  // admin-gated while auth is on (the API enforces it regardless)
  ...(status.value?.authEnabled && !isAdmin.value
    ? []
    : [{ to: '/clients', icon: 'i-lucide-key-round', label: 'nav.clients' }]),
  ...(status.value?.authEnabled && isAdmin.value
    ? [{ to: '/users', icon: 'i-lucide-users', label: 'nav.users' }]
    : []),
  { to: '/settings', icon: 'i-lucide-settings', label: 'nav.settings' }
])

function isActive (to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="flex flex-col h-full gap-4 p-3">
    <NuxtLink
      to="/"
      class="flex items-center gap-2 font-semibold text-highlighted px-2 py-1.5 shrink-0"
      @click="emit('dismiss')"
    >
      <img src="/logo.svg" class="size-6" alt="" />
      <span>MonStrata</span>
    </NuxtLink>

    <nav class="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto">
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
        :class="isActive(item.to)
          ? 'bg-primary/10 text-primary'
          : 'text-muted hover:text-default hover:bg-elevated'"
        @click="emit('dismiss')"
      >
        <UIcon :name="item.icon" class="size-4" />
        {{ t(item.label) }}
      </NuxtLink>
    </nav>

    <!-- utilities in one compact row, divider-separated from the nav:
         live state · version · theme · source · logout -->
    <div class="shrink-0 flex items-center justify-between gap-1 -mx-3 px-3 pt-2 border-t border-default">
      <UTooltip :text="connected ? t('common.liveHint') : t('common.pollHint')">
        <UIcon
          :name="connected ? 'i-lucide-radio' : 'i-lucide-wifi-off'"
          :class="connected ? 'text-success' : 'text-warning'"
          class="size-4 shrink-0"
        />
      </UTooltip>

      <!-- running build: commit of this checkout, flagged when origin moved on -->
      <UTooltip
        :text="updateStatus?.updateAvailable ? t('update.updateAvailable') : `MonStrata ${versionLabel || t('update.unknownVersion')}`"
      >
        <NuxtLink
          to="/settings"
          class="shrink-0 px-1 rounded inline-flex items-center gap-0.5 text-[11px] font-mono text-dimmed hover:text-default"
          :aria-label="t('update.title')"
          @click="emit('dismiss')"
        >
          <UIcon v-if="updateStatus?.updateAvailable" name="i-lucide-arrow-up-circle" class="size-3.5 text-warning" />
          <span>{{ versionLabel }}</span>
        </NuxtLink>
      </UTooltip>

      <!-- ClientOnly + fallback: avoids the stale aria-label hydration
           mismatch when the system theme differs from the SSR default -->
      <ClientOnly>
        <UColorModeButton
          size="xs"
          color="neutral"
          variant="ghost"
        />
        <template #fallback>
          <div class="size-6" />
        </template>
      </ClientOnly>

      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-github"
        :aria-label="t('footer.source')"
        to="https://github.com/Crdls/MonStrata"
        target="_blank"
        rel="noopener"
        class="shrink-0"
      />

      <UTooltip
        v-if="authUser"
        :text="t('auth.logoutAs', { username: authUser.username })"
      >
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          :aria-label="t('auth.logout')"
          class="shrink-0"
          @click="signOut()"
        />
      </UTooltip>
    </div>
  </div>
</template>
