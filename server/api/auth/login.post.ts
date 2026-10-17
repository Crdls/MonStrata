import {
  authStatus, clearLoginFailures, recordLoginFailure, startSession,
  throttleLogin, verifyPassword
} from '../../utils/auth'
import { loadConfig } from '../../utils/config'
import { getUserByUsername, touchLastLogin } from '../../utils/db'

export default defineEventHandler(async (event) => {
  if (!loadConfig().auth.enabled) throw createError({ statusCode: 403, statusMessage: 'Auth is disabled' })
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  await throttleLogin(ip)
  const body = await readBody<{ username?: string, password?: string }>(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const user = username ? getUserByUsername(username) : null
  const ok = user !== null && password.length > 0 && await verifyPassword(password, user.pass_hash)
  if (!user || !ok) {
    recordLoginFailure(ip)
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }
  clearLoginFailures(ip)
  touchLastLogin(user.id)
  startSession(event, user.id)
  return authStatus(event, { id: user.id, username: user.username, hasPassword: true })
})
