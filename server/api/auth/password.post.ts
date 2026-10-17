import { hashPassword, isPasswordValid, verifyPassword } from '../../utils/auth'
import { deleteUserSessions, getUserById, updatePassword } from '../../utils/db'

// change own password; the current session stays signed in, others are signed out
export default defineEventHandler(async (event) => {
  const userId = event.context.userId as number | undefined
  const tokenHash = event.context.sessionTokenHash as string | undefined
  if (!userId || !tokenHash) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const user = getUserById(userId)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readBody<{ currentPassword?: string, newPassword?: string }>(event)
  if (!user.pass_hash || !await verifyPassword(String(body?.currentPassword ?? ''), user.pass_hash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }
  if (!isPasswordValid(body?.newPassword)) throw createError({ statusCode: 400, statusMessage: 'password must be 8-1024 characters' })
  updatePassword(userId, await hashPassword(body.newPassword))
  deleteUserSessions(userId, tokenHash)
  return { ok: true }
})
