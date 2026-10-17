<script setup lang="ts">
import type { Locale } from '#i18n'
import type { AuthStatus } from '../composables/useAuth'

definePageMeta({ layout: false })

const { locale, setLocale, t } = useI18n()
const colorMode = useColorMode()
const { status } = useAuth()

// no users yet -> first-run account creation, otherwise sign in
const mode = computed(() => (status.value && !status.value.hasUsers ? 'setup' : 'signin'))

const form = reactive({ username: '', password: '', confirm: '' })
const error = ref('')
const busy = ref(false)
const mismatch = computed(() => mode.value === 'setup' && form.confirm.length > 0 && form.confirm !== form.password)

// language names are shown in their own language on purpose
const localeItems = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'zh', label: '中文' }
]
const selectedLocale = computed({
  get: () => locale.value,
  set: (value: string) => { void setLocale(value as Locale) }
})

async function submit () {
  if (busy.value || mismatch.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch<AuthStatus>(mode.value === 'setup' ? '/api/auth/setup' : '/api/auth/login', {
      method: 'POST',
      body: { username: form.username, password: form.password }
    })
    // full reload so the live plugin starts the WebSocket with the new cookie
    location.assign('/')
  } catch (err: unknown) {
    const e = err as { statusCode?: number, status?: number }
    const code = e?.statusCode ?? e?.status
    error.value = code === 401 ? t('auth.invalid')
      : code === 409 ? t('auth.setupDone')
        : code === 403 ? t('auth.disabled')
          : t('auth.failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-default flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="flex items-center justify-center gap-2 font-semibold text-highlighted mb-6">
        <UIcon name="i-lucide-activity" class="size-6 text-primary" />
        <span class="text-lg">MonStrata</span>
      </div>

      <UCard>
        <h1 class="text-lg font-semibold mb-1">
          {{ mode === 'setup' ? t('auth.setupTitle') : t('auth.signInTitle') }}
        </h1>
        <p class="text-sm text-muted mb-4">
          {{ mode === 'setup' ? t('auth.setupHint') : t('auth.signInHint') }}
        </p>

        <form class="space-y-4" @submit.prevent="submit">
          <UFormField :label="t('auth.username')">
            <UInput v-model="form.username" autofocus autocomplete="username" class="w-full" />
          </UFormField>

          <UFormField :label="t('auth.password')" :help="t('auth.passwordHelp')">
            <UInput v-model="form.password" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>

          <UFormField v-if="mode === 'setup'" :label="t('auth.confirmPassword')">
            <UInput
              v-model="form.confirm"
              type="password"
              autocomplete="new-password"
              class="w-full"
              :color="mismatch ? 'error' : undefined"
            />
            <p v-if="mismatch" class="text-xs text-error mt-1">{{ t('auth.mismatch') }}</p>
          </UFormField>

          <p v-if="error" class="text-sm text-error">{{ error }}</p>

          <UButton type="submit" block :loading="busy" :disabled="mismatch">
            {{ mode === 'setup' ? t('auth.createAccount') : t('auth.signInButton') }}
          </UButton>
        </form>
      </UCard>

      <div class="flex items-center justify-center gap-2 mt-5">
        <USelect
          v-model="selectedLocale"
          :items="localeItems"
          size="sm"
          color="neutral"
          variant="ghost"
          class="w-28"
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
    </div>
  </div>
</template>
