export interface LastUpdateResult {
  startedAt: number
  finishedAt: number
  ok: boolean
  step: string | null
  error: string | null
}

export interface UpdateStatus {
  /** commit of the running checkout; null when it is not a git checkout */
  currentSha: string | null
  /** commit time of the running checkout (ms) for the version label */
  commitTs: number | null
  branch: string | null
  latestSha: string | null
  updateAvailable: boolean
  compareUrl: string | null
  checkedAt: number | null
  checking: boolean
  error: string | null
  dev: boolean
  applying: boolean
  lastUpdate: LastUpdateResult | null
}

/** Short form of a commit SHA for the UI; '?' when the version is unknown. */
export function shortVersion (sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '?'
}

export function useUpdate () {
  // one shared fetch per page load (sidebar chip + settings card);
  // client-side only so ordinary SSR page renders do not add an /api hop
  const { data, pending, refresh } = useFetch<UpdateStatus>('/api/update/status', {
    key: 'update-status',
    server: false,
    lazy: true
  })

  async function checkNow (): Promise<void> {
    await $fetch('/api/update/check', { method: 'POST' })
    await refresh()
  }

  return { status: data, pending, refresh, checkNow }
}
