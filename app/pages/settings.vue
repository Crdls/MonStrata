<script setup lang="ts">
interface Settings {
  scrapeIntervalS: number
  rollupIntervalS: number
  rawRetentionH: number
  hourlyRetentionD: number
}

const { data, refresh } = useFetch<Settings>('/api/settings')
const toast = useToast()

const form = reactive<Settings>({ scrapeIntervalS: 10, rollupIntervalS: 30, rawRetentionH: 48, hourlyRetentionD: 400 })
watchEffect(() => {
  if (data.value) Object.assign(form, data.value)
})

const saving = ref(false)

async function save () {
  saving.value = true
  try {
    await $fetch('/api/settings', { method: 'PUT', body: { ...form } })
    await refresh()
    toast.add({ title: 'Settings saved', description: 'New intervals take effect immediately', color: 'success' })
  } catch (err: unknown) {
    toast.add({
      title: 'Could not save settings',
      description: (err as { statusMessage?: string })?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-xl font-semibold mb-1">Settings</h1>
    <p class="text-sm text-muted mb-5">Background job intervals and data retention. Changes apply without a restart.</p>

    <UCard>
      <form class="space-y-5" @submit.prevent="save">
        <UFormField
          label="Scrape interval (seconds)"
          help="How often every enabled server's /metrics is polled. 2–600."
        >
          <UInputNumber v-model="form.scrapeIntervalS" :min="2" :max="600" :step="1" class="w-40" />
        </UFormField>

        <UFormField
          label="Rollup interval (seconds)"
          help="How often raw samples are downsampled into hourly/daily aggregates and old raw data is pruned. 5–3600."
        >
          <UInputNumber v-model="form.rollupIntervalS" :min="5" :max="3600" :step="5" class="w-40" />
        </UFormField>

        <UFormField
          label="Raw data retention (hours)"
          help="Raw samples older than this are deleted. Drives the 24h heatmap and short-range charts. 1–720."
        >
          <UInputNumber v-model="form.rawRetentionH" :min="1" :max="720" :step="1" class="w-40" />
        </UFormField>

        <UFormField
          label="Hourly rollup retention (days)"
          help="Hourly aggregates older than this are deleted. Daily aggregates are kept forever. 7–3650."
        >
          <UInputNumber v-model="form.hourlyRetentionD" :min="7" :max="3650" :step="1" class="w-40" />
        </UFormField>

        <div class="flex justify-end pt-2">
          <UButton type="submit" :loading="saving">
            Save
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
