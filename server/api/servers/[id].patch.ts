import { useDb, type ServerRow } from '../../utils/db'
import { broadcast, scrapeServer, validateBaseUrl } from '../../utils/scrape'
import { forgetServerState } from '../../utils/runtime'
import { assertCanManageServer } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow | undefined
  if (!server) throw createError({ statusCode: 404, statusMessage: 'server not found' })
  assertCanManageServer(event, server)

  const body = await readBody<{ name?: string, url?: string, enabled?: boolean, apiKey?: string }>(event)
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
  // undefined keeps the stored key, an empty string clears it
  const apiKey = body?.apiKey === undefined ? server.api_key : (body.apiKey.trim() || null)

  db.prepare('UPDATE servers SET name = ?, url = ?, enabled = ?, api_key = ? WHERE id = ?').run(name, url, enabled, apiKey, id)
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
