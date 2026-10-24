import { isAdmissible, loadScore, type ServerLoad } from './types.ts'

/**
 * Server selection, pure: given the live load of every engine, decide where
 * the next request goes — or nowhere (the caller queues it).
 * Reachable from bare Node tests.
 */

export interface RouteDecision {
  /** chosen server, null when nothing can take the request right now */
  serverId: number | null
  /** true when the choice was driven by chat affinity (keeps the KV cache) */
  affinity: boolean
}

/**
 * Affinity wins while the owning server still admits work; when it does not
 * (offline, drained, ejected, full) we gracefully degrade to the least-loaded
 * candidate and let the caller rewrite the affinity mapping.
 */
export function pickServer (loads: ServerLoad[], preferredId: number | null, now: number): RouteDecision {
  const open = loads.filter(s => isAdmissible(s, now))
  if (preferredId != null) {
    const home = open.find(s => s.id === preferredId)
    if (home) return { serverId: home.id, affinity: true }
  }
  if (open.length === 0) return { serverId: null, affinity: false }
  open.sort((a, b) => loadScore(a) - loadScore(b) || a.id - b.id)
  return { serverId: open[0]!.id, affinity: false }
}

/** True while at least one engine could take a request (queue-emptiness gate). */
export function hasCapacity (loads: ServerLoad[], now: number): boolean {
  return loads.some(s => isAdmissible(s, now))
}
