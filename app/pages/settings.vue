<script setup lang="ts">
import type { Locale } from '#i18n'

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
const { t, setLocale } = useI18n()
const { status, isAdmin } = useAuth()

const authed = computed(() => Boolean(status.value?.authEnabled && status.value?.user))
// background intervals are an admin concern while auth is on
const canEditIntervals = computed(() => !status.value?.authEnabled || isAdmin.value)
// GitLab sign-ins have no local password yet: the card turns into first-time setup
const hasPassword = computed(() => status.value?.user?.hasPassword !== false)

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

// language names are shown in their own language on purpose
const localeItems = computed(() => [
  { value: 'auto', label: t('settings.languageAuto') },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'zh', label: '中文' }
])
const langModel = ref<string>(status.value?.user?.lang ?? 'auto')

async function onLangChange (value: string | number | null) {
  const lang = value === 'auto' || value === null ? null : String(value)
  // with a session the choice goes to the user record; with auth off this
  // 401s and only the locale cookie changes (the pre-login behavior)
  if (status.value?.authEnabled && status.value.user) {
    try {
      await $fetch('/api/auth/lang', { method: 'PUT', body: { lang } })
      status.value.user.lang = lang
      toast.add({ title: t('settings.toastSaved'), color: 'success' })
    } catch (err: unknown) {
      toast.add({
        title: t('settings.toastSaveFailed'),
        description: (err as { statusMessage?: string })?.statusMessage ?? String(err),
        color: 'error'
      })
      return
    }
  }
  if (lang) {
    await setLocale(lang as Locale)
    return
  }
  // auto: drop the cookie and reload so i18n re-detects the browser language
  if (import.meta.client) {
    document.cookie = 'monstrata_locale=; path=/; max-age=0'
    location.reload()
  }
}

// theme colors: write straight into appConfig (the Nuxt UI colors plugin
// regenerates the CSS variables) and persist the choice in localStorage
const appConfig = useAppConfig()
const accentColor = computed({
  get: () => appConfig.ui.colors.primary,
  set: (value: string) => {
    appConfig.ui.colors.primary = value
    storeTheme()
  }
})
const neutralColor = computed({
  get: () => appConfig.ui.colors.neutral,
  set: (value: string) => {
    appConfig.ui.colors.neutral = value
    storeTheme()
  }
})
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-xl font-semibold mb-1">{{ t('settings.title') }}</h1>
    <p v-if="canEditIntervals" class="text-sm text-muted mb-5">{{ t('settings.description') }}</p>

    <UCard>
      <h2 class="text-base font-semibold mb-1">{{ t('settings.appearance') }}</h2>
      <p class="text-sm text-muted mb-4">{{ t('settings.appearanceHelp') }}</p>
      <div class="space-y-5">
        <UFormField :label="t('settings.colorMode')">
          <UColorModeSelect class="w-48" :aria-label="t('settings.appearance')" />
        </UFormField>

        <UFormField :label="t('settings.language')" :help="t('settings.languageHelp')">
          <USelect v-model="langModel" :items="localeItems" class="w-48" :aria-label="t('settings.language')" @update:model-value="onLangChange" />
        </UFormField>

        <UFormField :label="t('settings.accentColor')">
          <div class="flex flex-wrap gap-2.5">
            <button
              v-for="s in primarySwatches"
              :key="s.value"
              type="button"
              class="size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
              :class="[s.class, accentColor === s.value ? 'ring-2 ring-offset-2 ring-offset-elevated ring-primary' : '']"
              :aria-label="t(`settings.themeColor.${s.value}`)"
              :aria-pressed="accentColor === s.value"
              @click="accentColor = s.value"
            />
          </div>
        </UFormField>

        <UFormField :label="t('settings.neutralPalette')">
          <div class="flex flex-wrap gap-2.5">
            <button
              v-for="s in neutralSwatches"
              :key="s.value"
              type="button"
              class="size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
              :class="[s.class, neutralColor === s.value ? 'ring-2 ring-offset-2 ring-offset-elevated ring-primary' : '']"
              :aria-label="t(`settings.themeColor.${s.value}`)"
              :aria-pressed="neutralColor === s.value"
              @click="neutralColor = s.value"
            />
          </div>
        </UFormField>
      </div>
    </UCard>

    <UCard v-if="canEditIntervals" class="mt-6">
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
      <h2 class="text-base font-semibold mb-1">{{ hasPassword ? t('auth.changePassword') : t('auth.setPassword') }}</h2>
      <p class="text-sm text-muted mb-4">{{ hasPassword ? t('auth.changePasswordHint') : t('auth.setPasswordHint') }}</p>
      <form class="space-y-5" @submit.prevent="changePassword">
        <UFormField v-if="hasPassword" :label="t('auth.currentPassword')">
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
            {{ hasPassword ? t('auth.changePassword') : t('auth.setPassword') }}
          </UButton>
        </div>
      </form>
    </UCard>

  </div>
</template>
