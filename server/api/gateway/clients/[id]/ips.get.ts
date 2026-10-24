import { requireAdmin } from '../../../../utils/auth'
import { loadConfig } from '../../../../utils/config'
import { getGatewayClientById, listClientIps } from '../../../../utils/db'

// where this client's requests actually come from, newest first
export default defineEventHandler(async (event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!getGatewayClientById(id)) throw createError({ statusCode: 404, statusMessage: 'client not found' })
  return listClientIps(id, 200)
})
