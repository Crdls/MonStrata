/**
 * Process-wide runtime state. Stored on globalThis so that Nitro dev HMR
 * reloads of plugins/utils do not duplicate timers or lose state.
 */

export interface Snapshot {
  serverId: number
  ts: number
  up: boolean
  error?: string
  /** metric key -> list of [normalized labels, value] */
  metrics: Record<string, Array<[string, number]>>
}

interface Runtime {
  /** `${serverId}|${metric}|${labels}` -> last value (for counter deltas) */
  prev: Map<string, number>
  /** serverId -> last successful scrape ts (ms) */
  prevTs: Map<number, number>
  /** serverId -> last snapshot */
  snapshots: Map<number, Snapshot>
  scrapeTimer?: ReturnType<typeof setTimeout>
  rollupTimer?: ReturnType<typeof setTimeout>
  scraping: boolean
}

const g = globalThis as typeof globalThis & { __stratamon?: Runtime }

export function runtime (): Runtime {
  if (!g.__stratamon) {
    g.__stratamon = {
      prev: new Map(),
      prevTs: new Map(),
      snapshots: new Map(),
      scraping: false
    }
  }
  return g.__stratamon
}

export function forgetServerState (serverId: number) {
  const rt = runtime()
  rt.snapshots.delete(serverId)
  rt.prevTs.delete(serverId)
  for (const key of rt.prev.keys()) {
    if (key.startsWith(`${serverId}|`)) rt.prev.delete(key)
  }
}
