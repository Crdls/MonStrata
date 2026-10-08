import { useDb } from '../../utils/db'
import { broadcast } from '../../utils/scrape'
import { forgetServerState } from '../../utils/runtime'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  if (!db.prepare('SELECT 1 FROM servers WHERE id = ?').get(id)) {
    throw createError({ statusCode: 404, statusMessage: 'server not found' })
  }
  const tx = db.transaction((serverId: number) => {
    db.prepare('DELETE FROM servers WHERE id = ?').run(serverId)
    db.prepare('DELETE FROM samples WHERE server_id = ?').run(serverId)
    db.prepare('DELETE FROM rollup_hourly WHERE server_id = ?').run(serverId)
    db.prepare('DELETE FROM rollup_daily WHERE server_id = ?').run(serverId)
    db.prepare('DELETE FROM server_status WHERE server_id = ?').run(serverId)
  })
  tx(id)
  forgetServerState(id)
  broadcast({ type: 'removed', serverId: id })
  return { ok: true }
})
