<script setup lang="ts">
interface ServerRow {
  id: number
  name: string
  url: string
  enabled: boolean
  createdAt: number
  createdBy: number | null
  createdByName: string | null
  up: boolean | null
  lastScrape: number | null
  error: string | null
}

const { data: servers, refresh } = useFetch<ServerRow[]>('/api/servers', {
  // forward cookies on the SSR-side call so the auth middleware lets it through
  headers: useRequestHeaders(['cookie'])
})
const toast = useToast()
const { t } = useI18n()
const { status } = useAuth()

// only the creator or an admin may change a server (the API enforces it too)
function canManage (server: ServerRow): boolean {
  if (!status.value?.authEnabled) return true
  const user = status.value.user
  if (user?.role === 'admin') return true
  return server.createdBy != null && server.createdBy === user?.id
}

const formOpen = ref(false)
const editing = ref<ServerRow | null>(null)
const form = reactive({ name: '', url: '' })
const saving = ref(false)
const deleteTarget = ref<ServerRow | null>(null)
const pinging = ref<number | null>(null)

function openAdd () {
  editing.value = null
  form.name = ''
  form.url = ''
  formOpen.value = true
}

// ?add=1 from the dashboard opens the form immediately
const route = useRoute()
const router = useRouter()
onMounted(() => {
  if (route.query.add) {
    openAdd()
    void router.replace({ query: { ...route.query, add: undefined } })
  }
})

function openEdit (server: ServerRow) {
  editing.value = server
  form.name = server.name
  form.url = server.url
  formOpen.value = true
}

async function save () {
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/servers/${editing.value.id}`, { method: 'PATCH', body: { ...form } })
    } else {
      await $fetch('/api/servers', { method: 'POST', body: { ...form } })
    }
    formOpen.value = false
    toast.add({ title: t('servers.toastSaved'), color: 'success' })
    await refresh()
  } catch (err: unknown) {
    toast.add({
      title: t('servers.toastSaveFailed'),
      description: (err as { statusMessage?: string })?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function toggle (server: ServerRow, enabled: boolean) {
  try {
    await $fetch(`/api/servers/${server.id}`, { method: 'PATCH', body: { enabled } })
    await refresh()
  } catch {
    toast.add({ title: t('servers.toastToggleFailed'), color: 'error' })
  }
}

async function ping (server: ServerRow) {
  pinging.value = server.id
  try {
    const res = await $fetch<{ ok: boolean, ms: number, series?: number, error?: string }>(
      `/api/servers/${server.id}/ping`,
      { method: 'POST' }
    )
    toast.add(res.ok
      ? { title: t('servers.toastReachable', { name: server.name, ms: res.ms }), description: t('servers.toastParsed', { n: res.series ?? 0 }), color: 'success' }
      : { title: t('servers.toastUnreachable', { name: server.name }), description: res.error, color: 'error' })
  } catch {
    toast.add({ title: t('servers.toastPingFailed'), color: 'error' })
  } finally {
    pinging.value = null
  }
}

async function remove () {
  if (!deleteTarget.value) return
  try {
    await $fetch(`/api/servers/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: t('servers.toastRemoved'), color: 'success' })
    await refresh()
  } finally {
    deleteTarget.value = null
  }
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => void refresh(), 10_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-semibold">{{ t('servers.title') }}</h1>
        <p class="text-sm text-muted mt-0.5">{{ t('servers.subtitle') }}</p>
      </div>
      <UButton icon="i-lucide-plus" size="sm" @click="openAdd">
        {{ t('common.addServer') }}
      </UButton>
    </div>

    <UCard>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-muted border-b border-default">
            <th class="py-2 pr-3 font-medium">{{ t('servers.name') }}</th>
            <th class="py-2 pr-3 font-medium">URL</th>
            <th class="py-2 pr-3 font-medium text-center">{{ t('servers.status') }}</th>
            <th class="py-2 pr-3 font-medium text-center">{{ t('servers.enabled') }}</th>
            <th class="py-2 font-medium text-right">{{ t('servers.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="server in servers ?? []" :key="server.id" class="border-b border-default/50 last:border-0">
            <td class="py-2.5 pr-3">
              <NuxtLink :to="`/servers/${server.id}`" class="font-medium hover:text-primary">
                {{ server.name }}
              </NuxtLink>
              <div v-if="server.createdByName" class="text-xs text-dimmed">
                {{ t('servers.owner', { name: server.createdByName }) }}
              </div>
              <div v-else-if="server.createdBy" class="text-xs text-dimmed">
                {{ t('servers.ownerUnknown') }}
              </div>
            </td>
            <td class="py-2.5 pr-3 text-muted max-w-64 truncate">
              {{ server.url }}
            </td>
            <td class="py-2.5 pr-3 text-center">
              <UBadge
                v-if="!server.enabled"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ t('servers.statusOff') }}
              </UBadge>
              <UBadge
                v-else-if="server.up"
                color="success"
                variant="subtle"
                size="sm"
              >
                {{ t('servers.statusUp') }}
              </UBadge>
              <UTooltip v-else :text="server.error ?? ''">
                <UBadge color="error" variant="subtle" size="sm">
                  {{ server.up === null ? t('servers.statusNa') : t('servers.statusDown') }}
                </UBadge>
              </UTooltip>
            </td>
            <td class="py-2.5 pr-3 text-center">
              <USwitch
                v-if="canManage(server)"
                :model-value="server.enabled"
                size="sm"
                @update:model-value="toggle(server, $event as boolean)"
              />
            </td>
            <td class="py-2.5 text-right whitespace-nowrap">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-plug-zap"
                :loading="pinging === server.id"
                @click="ping(server)"
              >
                {{ t('servers.test') }}
              </UButton>
              <UButton v-if="canManage(server)" size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="openEdit(server)">
                {{ t('servers.edit') }}
              </UButton>
              <UButton v-if="canManage(server)" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="deleteTarget = server">
                {{ t('servers.delete') }}
              </UButton>
            </td>
          </tr>
          <tr v-if="!servers?.length">
            <td colspan="5" class="py-10 text-center text-muted">
              {{ t('servers.empty') }}
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <!-- add / edit modal -->
    <UModal v-model:open="formOpen" :title="editing ? t('servers.editTitle', { name: editing.name }) : t('servers.addTitle')">
      <template #body>
        <form class="space-y-4" @submit.prevent="save">
          <UFormField :label="t('servers.name')" required>
            <UInput v-model="form.name" placeholder="r2d2" class="w-full" autofocus />
          </UFormField>
          <UFormField :label="t('servers.baseUrl')" required :help="t('servers.baseUrlHelp')">
            <UInput v-model="form.url" placeholder="http://192.168.10.76:8000" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="formOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" :loading="saving">
              {{ editing ? t('common.save') : t('servers.add') }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- delete confirm -->
    <UModal
      :open="!!deleteTarget"
      :title="t('servers.confirmTitle')"
      @update:open="(v: boolean) => { if (!v) deleteTarget = null }"
    >
      <template #body>
        <p class="text-sm">
          {{ t('servers.confirmText', { name: deleteTarget?.name ?? '' }) }}
        </p>
        <div class="flex justify-end gap-2 pt-4">
          <UButton color="neutral" variant="ghost" @click="deleteTarget = null">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" @click="remove">
            {{ t('servers.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
