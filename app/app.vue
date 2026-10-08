<script setup lang="ts">
useHead({
  titleTemplate: (title?: string | null) => (title ? `${title} · StrataMon` : 'StrataMon')
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
