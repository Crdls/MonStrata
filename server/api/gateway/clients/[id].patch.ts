import { requireAdmin } from '../../../utils/auth'
import { loadConfig } from '../../../utils/config'
import { getGatewayClientById, updateGatewayClient } from '../../../utils/db'
import { PRIORITIES, type ClientPriority } from '../../../utils/gateway/types'
import { clientViewPlain } from '../../../utils/gateway/view'

export default defineEventHandler(async (event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!getGatewayClientById(id)) throw createError({ statusCode: 404, statusMessage: 'client not found' })
  const body = await readBody<{ name?: string, priority?: string, debug?: boolean, enabled?: boolean }>(event)
  const patch: { name?: string, priority?: ClientPriority, debug?: boolean, enabled?: boolean } = {}
  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 64) throw createError({ statusCode: 400, statusMessage: 'name is required (max 64 chars)' })
    patch.name = name
  }
  if (body?.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority as ClientPriority)) {
      throw createError({ statusCode: 400, statusMessage: 'priority must be high, normal or low' })
    }
    patch.priority = body.priority as ClientPriority
  }
  if (body?.debug !== undefined) patch.debug = body.debug === true
  if (body?.enabled !== undefined) patch.enabled = body.enabled === true
  updateGatewayClient(id, patch)
  return clientViewPlain(getGatewayClientById(id)!)
})
