export interface LiveSnapshot {
  serverId: number
  ts: number
  up: boolean
  error?: string
  /** metric key -> list of [normalized labels, value] */
  metrics: Record<string, Array<[string, number]>>
}

export interface LiveServer {
  id: number
  name: string
  url: string
  enabled: boolean
  snapshot: LiveSnapshot | null
}

export interface LiveApi {
  servers: Ref<LiveServer[]>
  connected: Ref<boolean>
  refresh: () => Promise<void>
}

export default defineNuxtPlugin(() => {
  const servers = ref<LiveServer[]>([])
  const connected = ref(false)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let pollTimer: ReturnType<typeof setInterval> | undefined

  async function refresh () {
    try {
      servers.value = await $fetch<LiveServer[]>('/api/live')
    } catch {
      // server unreachable - keep whatever we have
    }
  }

  function applySnapshot (snap: LiveSnapshot) {
    const server = servers.value.find(s => s.id === snap.serverId)
    if (server) server.snapshot = snap
    else void refresh()
  }

  function connect () {
    if (!import.meta.client || ws) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/_ws`)
    ws.onopen = () => { connected.value = true }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data))
        if (msg.type === 'snapshot') applySnapshot(msg.snapshot as LiveSnapshot)
        else if (msg.type === 'removed') servers.value = servers.value.filter(s => s.id !== msg.serverId)
      } catch { /* ignore malformed frames */ }
    }
    ws.onclose = () => {
      connected.value = false
      ws = null
      reconnectTimer = setTimeout(connect, 3000)
    }
    ws.onerror = () => { ws?.close() }
  }

  onNuxtReady(async () => {
    await refresh()
    connect()
    // safety net in case the websocket is blocked by a proxy
    pollTimer = setInterval(() => { if (!connected.value) void refresh() }, 5000)
  })

  if (import.meta.client) {
    window.addEventListener('beforeunload', () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pollTimer) clearInterval(pollTimer)
      ws?.close()
    })
  }

  return { provide: { live: { servers, connected, refresh } satisfies LiveApi } }
})
