import { useDb, type ServerRow } from '../../utils/db'
import { broadcast, scrapeServer, validateBaseUrl } from '../../utils/scrape'
import { forgetServerState } from '../../utils/runtime'
import { assertCanManageServer } from '../../utils/auth'
import { GATEWAY_MODES, type GatewayMode } from '../../utils/gateway/types'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow | undefined
  if (!server) throw createError({ statusCode: 404, statusMessage: 'server not found' })
  assertCanManageServer(event, server)

  const body = await readBody<{ name?: string, url?: string, enabled?: boolean, apiKey?: string, gatewayMode?: string, gatewayCapacity?: number | null }>(event)
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

  let gatewayMode = server.gateway_mode
  if (body?.gatewayMode !== undefined) {
    if (!GATEWAY_MODES.includes(body.gatewayMode as GatewayMode)) {
      throw createError({ statusCode: 400, statusMessage: 'gatewayMode must be on, drain or off' })
    }
    gatewayMode = body.gatewayMode as GatewayMode
  }
  let gatewayCapacity = server.gateway_capacity
  if (body?.gatewayCapacity !== undefined) {
    if (body.gatewayCapacity === null) gatewayCapacity = null
    else {
      const n = Math.round(Number(body.gatewayCapacity))
      if (!Number.isFinite(n) || n < 1 || n > 4096) {
        throw createError({ statusCode: 400, statusMessage: 'gatewayCapacity must be between 1 and 4096 or null' })
      }
      gatewayCapacity = n
    }
  }

  db.prepare('UPDATE servers SET name = ?, url = ?, enabled = ?, api_key = ?, gateway_mode = ?, gateway_capacity = ? WHERE id = ?')
    .run(name, url, enabled, apiKey, gatewayMode, gatewayCapacity, id)
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
