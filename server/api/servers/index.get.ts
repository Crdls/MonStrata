import { useDb, type ServerRow } from '../../utils/db'
import { runtime } from '../../utils/runtime'

export default defineEventHandler(() => {
  const servers = useDb().prepare('SELECT * FROM servers ORDER BY name COLLATE NOCASE').all() as ServerRow[]
  const rt = runtime()
  return servers.map((s) => {
    const snap = rt.snapshots.get(s.id)
    return {
      id: s.id,
      name: s.name,
      url: s.url,
      enabled: s.enabled === 1,
      createdAt: s.created_at,
      up: snap ? snap.up : null,
      lastScrape: snap?.ts ?? null,
      error: snap?.error ?? null
    }
  })
})
