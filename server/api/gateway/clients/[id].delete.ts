import { requireAdmin } from '../../../utils/auth'
import { loadConfig } from '../../../utils/config'
import { deleteGatewayClient, getGatewayClientById } from '../../../utils/db'

// deleting also drops the client's IP history and usage counters
export default defineEventHandler(async (event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!getGatewayClientById(id)) throw createError({ statusCode: 404, statusMessage: 'client not found' })
  deleteGatewayClient(id)
  return { ok: true }
})
