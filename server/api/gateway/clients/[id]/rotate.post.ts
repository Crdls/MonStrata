import { requireAdmin } from '../../../../utils/auth'
import { loadConfig } from '../../../../utils/config'
import { getGatewayClientById, getGatewayClientByTokenHash, setGatewayClientToken } from '../../../../utils/db'
import { hashToken } from '../../../../utils/credentials'
import { generateClientToken, tokenHint } from '../../../../utils/gateway/tokens'

// new token for an existing client; the old one stops working at once
export default defineEventHandler(async (event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!getGatewayClientById(id)) throw createError({ statusCode: 404, statusMessage: 'client not found' })
  let token = generateClientToken()
  // collide-proof by construction, but never overwrite another client's key
  for (let i = 0; i < 3 && getGatewayClientByTokenHash(hashToken(token)); i++) token = generateClientToken()
  if (getGatewayClientByTokenHash(hashToken(token))) {
    throw createError({ statusCode: 500, statusMessage: 'could not generate a unique token' })
  }
  setGatewayClientToken(id, hashToken(token), tokenHint(token))
  return { token }
})
