<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()

const nav = [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Heatmap', to: '/heatmap', icon: 'i-lucide-grid-3x3' },
  { label: 'Servers', to: '/servers', icon: 'i-lucide-server' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' }
]

function isActive (to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="border-b border-default bg-elevated/50 backdrop-blur sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-highlighted">
          <UIcon name="i-lucide-activity" class="size-5 text-primary" />
          <span>StrataMon</span>
        </NuxtLink>
        <nav class="flex items-center gap-1 flex-1">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors"
            :class="isActive(item.to)
              ? 'bg-primary/10 text-primary'
              : 'text-muted hover:text-default hover:bg-elevated'"
          >
            <UIcon :name="item.icon" class="size-4" />
            {{ item.label }}
          </NuxtLink>
        </nav>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="colorMode.preference === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
          :aria-label="`Switch to ${colorMode.preference === 'dark' ? 'light' : 'dark'} mode`"
          @click="colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'"
        />
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
