import { requireAdmin } from '../../../../utils/auth'
import { loadConfig } from '../../../../utils/config'
import { setServerClientAccess, useDb } from '../../../../utils/db'
import { parseExistingIds } from '../../../../utils/gateway/access'

// replace the client list allowed to route through this server (admin-only while auth is on)
export default defineEventHandler(async (event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!useDb().prepare('SELECT 1 FROM servers WHERE id = ?').get(id)) {
    throw createError({ statusCode: 404, statusMessage: 'server not found' })
  }
  const body = await readBody<{ clientIds?: unknown }>(event)
  const ids = parseExistingIds(body?.clientIds, 'gateway_clients')
  if (!ids) throw createError({ statusCode: 400, statusMessage: 'clientIds must be a list of existing client ids' })
  setServerClientAccess(id, ids)
  return { ok: true }
})
