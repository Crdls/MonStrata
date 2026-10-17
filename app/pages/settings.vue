<script setup lang="ts">
interface Settings {
  scrapeIntervalS: number
  rollupIntervalS: number
  rawRetentionH: number
  hourlyRetentionD: number
}

const { data, refresh } = useFetch<Settings>('/api/settings', {
  // forward cookies on the SSR-side call so the auth middleware lets it through
  headers: useRequestHeaders(['cookie'])
})
const toast = useToast()
const { t } = useI18n()
const { status } = useAuth()

const authed = computed(() => Boolean(status.value?.authEnabled && status.value?.user))

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
    toast.add({ title: t('settings.toastSaved'), description: t('settings.toastApplied'), color: 'success' })
  } catch (err: unknown) {
    toast.add({
      title: t('settings.toastSaveFailed'),
      description: (err as { statusMessage?: string })?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

const pwd = reactive({ current: '', next: '', confirm: '' })
const pwdSaving = ref(false)
const pwdMismatch = computed(() => pwd.confirm.length > 0 && pwd.confirm !== pwd.next)

async function changePassword () {
  if (pwdSaving.value || pwdMismatch.value) return
  pwdSaving.value = true
  try {
    await $fetch('/api/auth/password', {
      method: 'POST',
      body: { currentPassword: pwd.current, newPassword: pwd.next }
    })
    toast.add({ title: t('auth.toastPasswordChanged'), color: 'success' })
    pwd.current = ''
    pwd.next = ''
    pwd.confirm = ''
  } catch (err: unknown) {
    const e = err as { statusMessage?: string, statusCode?: number, status?: number }
    const code = e?.statusCode ?? e?.status
    toast.add({
      title: t('auth.toastPasswordFailed'),
      description: code === 401 ? t('auth.invalid') : e?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    pwdSaving.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-xl font-semibold mb-1">{{ t('settings.title') }}</h1>
    <p class="text-sm text-muted mb-5">{{ t('settings.description') }}</p>

    <UCard>
      <form class="space-y-5" @submit.prevent="save">
        <UFormField :label="t('settings.scrape')" :help="t('settings.scrapeHelp')">
          <UInputNumber v-model="form.scrapeIntervalS" :min="2" :max="600" :step="1" class="w-40" />
        </UFormField>

        <UFormField :label="t('settings.rollup')" :help="t('settings.rollupHelp')">
          <UInputNumber v-model="form.rollupIntervalS" :min="5" :max="3600" :step="5" class="w-40" />
        </UFormField>

        <UFormField :label="t('settings.rawRetention')" :help="t('settings.rawRetentionHelp')">
          <UInputNumber v-model="form.rawRetentionH" :min="1" :max="720" :step="1" class="w-40" />
        </UFormField>

        <UFormField :label="t('settings.hourlyRetention')" :help="t('settings.hourlyRetentionHelp')">
          <UInputNumber v-model="form.hourlyRetentionD" :min="7" :max="3650" :step="1" class="w-40" />
        </UFormField>

        <div class="flex justify-end pt-2">
          <UButton type="submit" :loading="saving">
            {{ t('common.save') }}
          </UButton>
        </div>
      </form>
    </UCard>

    <UCard v-if="authed" class="mt-6">
      <h2 class="text-base font-semibold mb-1">{{ t('auth.changePassword') }}</h2>
      <p class="text-sm text-muted mb-4">{{ t('auth.changePasswordHint') }}</p>
      <form class="space-y-5" @submit.prevent="changePassword">
        <UFormField :label="t('auth.currentPassword')">
          <UInput v-model="pwd.current" type="password" autocomplete="current-password" class="w-64" />
        </UFormField>

        <UFormField :label="t('auth.newPassword')" :help="t('auth.passwordHelp')">
          <UInput v-model="pwd.next" type="password" autocomplete="new-password" class="w-64" />
        </UFormField>

        <UFormField :label="t('auth.confirmNewPassword')">
          <UInput
            v-model="pwd.confirm"
            type="password"
            autocomplete="new-password"
            class="w-64"
            :color="pwdMismatch ? 'error' : undefined"
          />
          <p v-if="pwdMismatch" class="text-xs text-error mt-1">{{ t('auth.mismatch') }}</p>
        </UFormField>

        <div class="flex justify-end pt-2">
          <UButton type="submit" :loading="pwdSaving" :disabled="pwdMismatch">
            {{ t('auth.changePassword') }}
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
