import { useDb, type ServerRow } from '../../utils/db'
import { runtime } from '../../utils/runtime'

interface ServerListRow extends ServerRow {
  created_by_name: string | null
}

export default defineEventHandler(() => {
  const servers = useDb().prepare(`SELECT s.*, u.username AS created_by_name
                                    FROM servers s LEFT JOIN users u ON u.id = s.created_by
                                    ORDER BY s.name COLLATE NOCASE`).all() as ServerListRow[]
  const rt = runtime()
  return servers.map((s) => {
    const snap = rt.snapshots.get(s.id)
    return {
      id: s.id,
      name: s.name,
      url: s.url,
      enabled: s.enabled === 1,
      apiKey: s.api_key,
      createdAt: s.created_at,
      createdBy: s.created_by,
      createdByName: s.created_by_name,
      up: snap ? snap.up : null,
      lastScrape: snap?.ts ?? null,
      error: snap?.error ?? null
    }
  })
})
