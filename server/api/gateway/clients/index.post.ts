import { requireAdmin } from '../../../utils/auth'
import { loadConfig } from '../../../utils/config'
import { createGatewayClient, getGatewayClientByTokenHash } from '../../../utils/db'
import { hashToken } from '../../../utils/credentials'
import { PRIORITIES, type ClientPriority } from '../../../utils/gateway/types'
import { generateClientToken, normalizeCustomToken, tokenHint } from '../../../utils/gateway/tokens'
import { clientViewPlain } from '../../../utils/gateway/view'

// create a client; the raw token is returned exactly once, here
export default defineEventHandler(async (event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const body = await readBody<{ name?: string, priority?: string, debug?: boolean, token?: string }>(event)
  const name = body?.name?.trim()
  if (!name || name.length > 64) {
    throw createError({ statusCode: 400, statusMessage: 'name is required (max 64 chars)' })
  }
  const priority = body?.priority ?? 'normal'
  if (!PRIORITIES.includes(priority as ClientPriority)) {
    throw createError({ statusCode: 400, statusMessage: 'priority must be high, normal or low' })
  }
  let token = generateClientToken()
  if (body?.token !== undefined && String(body.token).trim() !== '') {
    const custom = normalizeCustomToken(body.token)
    if (!custom) {
      throw createError({ statusCode: 400, statusMessage: 'a custom token must be 16–256 printable characters without spaces' })
    }
    token = custom
  }
  const tokenHash = hashToken(token)
  if (getGatewayClientByTokenHash(tokenHash)) {
    throw createError({ statusCode: 409, statusMessage: 'this token is already in use' })
  }
  const client = createGatewayClient({
    name,
    tokenHash,
    tokenHint: tokenHint(token),
    priority: priority as ClientPriority,
    debug: body?.debug === true,
    createdBy: event.context.userId ?? null
  })
  return { ...clientViewPlain(client), token }
})
