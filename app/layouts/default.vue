<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()
const { locale, t } = useI18n()

const nav = [
  { to: '/', icon: 'i-lucide-layout-dashboard', label: 'nav.dashboard' },
  { to: '/heatmap', icon: 'i-lucide-grid-3x3', label: 'nav.heatmap' },
  { to: '/servers', icon: 'i-lucide-server', label: 'nav.servers' },
  { to: '/settings', icon: 'i-lucide-settings', label: 'nav.settings' }
]

// language names are shown in their own language on purpose
const localeItems = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'zh', label: '中文' }
]

function isActive (to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="border-b border-default bg-elevated/50 backdrop-blur sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4 lg:gap-6">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-highlighted shrink-0">
          <UIcon name="i-lucide-activity" class="size-5 text-primary" />
          <span>StrataMon</span>
        </NuxtLink>
        <nav class="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            :class="isActive(item.to)
              ? 'bg-primary/10 text-primary'
              : 'text-muted hover:text-default hover:bg-elevated'"
          >
            <UIcon :name="item.icon" class="size-4" />
            {{ t(item.label) }}
          </NuxtLink>
        </nav>
        <USelect
          v-model="locale"
          :items="localeItems"
          size="sm"
          color="neutral"
          variant="ghost"
          class="w-28 shrink-0"
          :aria-label="t('nav.settings')"
          icon="i-lucide-languages"
        />
        <ClientOnly>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="colorMode.preference === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
            :aria-label="`Switch to ${colorMode.preference === 'dark' ? 'light' : 'dark'} mode`"
            @click="colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'"
          />
          <template #fallback>
            <div class="size-8" />
          </template>
        </ClientOnly>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
