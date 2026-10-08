<script setup lang="ts">
interface ServerRow {
  id: number
  name: string
  url: string
  enabled: boolean
  createdAt: number
  up: boolean | null
  lastScrape: number | null
  error: string | null
}

const { data: servers, refresh } = useFetch<ServerRow[]>('/api/servers')
const toast = useToast()

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
    toast.add({ title: 'Server saved', color: 'success' })
    await refresh()
  } catch (err: unknown) {
    toast.add({
      title: 'Could not save server',
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
    toast.add({ title: 'Toggle failed', color: 'error' })
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
      ? { title: `${server.name}: reachable in ${res.ms} ms`, description: `${res.series} series parsed`, color: 'success' }
      : { title: `${server.name}: unreachable`, description: res.error, color: 'error' })
  } catch {
    toast.add({ title: 'Ping request failed', color: 'error' })
  } finally {
    pinging.value = null
  }
}

async function remove () {
  if (!deleteTarget.value) return
  try {
    await $fetch(`/api/servers/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Server removed', color: 'success' })
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
        <h1 class="text-xl font-semibold">Servers</h1>
        <p class="text-sm text-muted mt-0.5">Strata engines polled from their <code>/metrics</code> endpoint</p>
      </div>
      <UButton icon="i-lucide-plus" size="sm" @click="openAdd">
        Add server
      </UButton>
    </div>

    <UCard>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-muted border-b border-default">
            <th class="py-2 pr-3 font-medium">Name</th>
            <th class="py-2 pr-3 font-medium">URL</th>
            <th class="py-2 pr-3 font-medium text-center">Status</th>
            <th class="py-2 pr-3 font-medium text-center">Enabled</th>
            <th class="py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="server in servers ?? []" :key="server.id" class="border-b border-default/50 last:border-0">
            <td class="py-2.5 pr-3">
              <NuxtLink :to="`/servers/${server.id}`" class="font-medium hover:text-primary">
                {{ server.name }}
              </NuxtLink>
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
                off
              </UBadge>
              <UBadge
                v-else-if="server.up"
                color="success"
                variant="subtle"
                size="sm"
              >
                up
              </UBadge>
              <UTooltip v-else :text="server.error ?? 'not scraped yet'">
                <UBadge color="error" variant="subtle" size="sm">
                  {{ server.up === null ? 'n/a' : 'down' }}
                </UBadge>
              </UTooltip>
            </td>
            <td class="py-2.5 pr-3 text-center">
              <USwitch
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
                Test
              </UButton>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="openEdit(server)">
                Edit
              </UButton>
              <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="deleteTarget = server">
                Delete
              </UButton>
            </td>
          </tr>
          <tr v-if="!servers?.length">
            <td colspan="5" class="py-10 text-center text-muted">
              No servers yet. Click “Add server” to start monitoring.
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <!-- add / edit modal -->
    <UModal v-model:open="formOpen" :title="editing ? `Edit ${editing.name}` : 'Add server'">
      <template #body>
        <form class="space-y-4" @submit.prevent="save">
          <UFormField label="Name" required>
            <UInput v-model="form.name" placeholder="r2d2" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Base URL" required help="Metrics are read from <url>/metrics">
            <UInput v-model="form.url" placeholder="http://192.168.10.76:8000" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="formOpen = false">
              Cancel
            </UButton>
            <UButton type="submit" :loading="saving">
              {{ editing ? 'Save' : 'Add' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- delete confirm -->
    <UModal
      :open="!!deleteTarget"
      title="Remove server"
      @update:open="(v: boolean) => { if (!v) deleteTarget = null }"
    >
      <template #body>
        <p class="text-sm">
          Remove <b>{{ deleteTarget?.name }}</b> and all its stored history? This cannot be undone.
        </p>
        <div class="flex justify-end gap-2 pt-4">
          <UButton color="neutral" variant="ghost" @click="deleteTarget = null">
            Cancel
          </UButton>
          <UButton color="error" @click="remove">
            Delete
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
