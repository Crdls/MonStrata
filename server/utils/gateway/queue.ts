import type { ClientPriority } from './types.ts'

/**
 * Waiting-room scheduling, pure: strict priority (high → normal → low) with
 * aging so no level can starve, and fair round-robin between clients that
 * share a level (one chatty client must not eat the whole lane).
 *
 * Aging: a request is treated one level higher after waiting `lowToNormalMs`
 * (low only), then again after `normalToHighMs`. A permanently starved low
 * request therefore competes as high and gets served instead of timing out —
 * bounded starvation, the point of the whole scheme.
 * Reachable from bare Node tests.
 */

export interface AgingMs {
  lowToNormalMs: number
  normalToHighMs: number
}

/** 0 = served first. */
export function effectiveRank (priority: ClientPriority, waitedMs: number, aging: AgingMs): number {
  if (priority === 'high') return 0
  if (priority === 'normal') return waitedMs >= aging.normalToHighMs ? 0 : 1
  // low: 30s → treated as normal, +5m on top → treated as high
  if (waitedMs >= aging.lowToNormalMs + aging.normalToHighMs) return 0
  if (waitedMs >= aging.lowToNormalMs) return 1
  return 2
}

/** The waiting data the scheduler reasons about (resolve/grant lives in state). */
export interface QueueTask {
  seq: number
  clientId: number
  priority: ClientPriority
  enqueuedAt: number
}

/** A live waiting request: the task plus the wiring to hand it a server. */
export interface QueueEntry extends QueueTask {
  keyHash: string | null
  preferredId: number | null
  resolve: (serverId: number) => void
  reject: (err: unknown) => void
}

export interface QueuePick {
  index: number
  rank: number
}

/**
 * Choose the next task to dispatch: lowest effective rank; within that rank
 * the client served fewest times so far wins (round-robin fairness), oldest
 * task breaks the tie. `served` is incremented by the caller for the chosen
 * client — the scheduler itself never mutates it.
 */
export function pickNext (tasks: QueueTask[], now: number, served: Map<number, number>, aging: AgingMs): QueuePick | null {
  let best: QueuePick | null = null
  let bestRank = Infinity
  let bestServed = Infinity
  let bestAt = Infinity
  let bestSeq = Infinity
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]!
    const rank = effectiveRank(t.priority, now - t.enqueuedAt, aging)
    const cli = served.get(t.clientId) ?? 0
    const better = rank < bestRank
      || (rank === bestRank && cli < bestServed)
      || (rank === bestRank && cli === bestServed && t.enqueuedAt < bestAt)
      || (rank === bestRank && cli === bestServed && t.enqueuedAt === bestAt && t.seq < bestSeq)
    if (better) {
      best = { index: i, rank }
      bestRank = rank
      bestServed = cli
      bestAt = t.enqueuedAt
      bestSeq = t.seq
    }
  }
  return best
}
