import { useDb, type ServerRow } from '../../utils/db'
import { broadcast, scrapeServer, validateBaseUrl } from '../../utils/scrape'
import { forgetServerState } from '../../utils/runtime'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow | undefined
  if (!server) throw createError({ statusCode: 404, statusMessage: 'server not found' })

  const body = await readBody<{ name?: string, url?: string, enabled?: boolean }>(event)
  const name = body?.name?.trim() || server.name
  let url = server.url
  if (body?.url !== undefined && body.url !== server.url) {
    try {
      url = validateBaseUrl(body.url)
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'invalid url' })
    }
  }
  const enabled = body?.enabled === undefined ? server.enabled : (body.enabled ? 1 : 0)

  db.prepare('UPDATE servers SET name = ?, url = ?, enabled = ? WHERE id = ?').run(name, url, enabled, id)
  if (url !== server.url) forgetServerState(id)

  const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow
  if (enabled === 1) {
    scrapeServer(updated)
      .then(snapshot => broadcast({ type: 'snapshot', snapshot }))
      .catch(() => {})
  } else {
    forgetServerState(id)
    broadcast({ type: 'removed', serverId: id })
  }
  return { ...updated, enabled: updated.enabled === 1 }
})
