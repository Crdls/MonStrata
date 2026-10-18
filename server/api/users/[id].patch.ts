import { hashPassword, isPasswordValid, requireAdmin } from '../../utils/auth'
import { countActiveAdmins, deleteUserSessions, getUserById, updateUser, type UserRole } from '../../utils/db'
import { demotesActiveAdmin } from '../../utils/permissions'

// admin edit: role, freeze/unfreeze, assign a new password (the old one is
// not required); a reassigned password signs the user's other sessions out
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const target = getUserById(id)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'user not found' })

  const body = await readBody<{ role?: string, disabled?: boolean, password?: string }>(event)
  if (body?.role !== undefined && body.role !== 'admin' && body.role !== 'user') {
    throw createError({ statusCode: 400, statusMessage: "role must be 'admin' or 'user'" })
  }
  const patch: { role?: UserRole, disabled?: boolean, passHash?: string } = {
    role: body?.role as UserRole | undefined,
    disabled: typeof body?.disabled === 'boolean' ? body.disabled : undefined
  }
  if (id === event.context.userId && (patch.role === 'user' || patch.disabled === true)) {
    throw createError({ statusCode: 400, statusMessage: 'you cannot demote or freeze yourself' })
  }
  if (demotesActiveAdmin(target, patch) && countActiveAdmins() <= 1) {
    throw createError({ statusCode: 409, statusMessage: 'this is the last active admin' })
  }
  if (body?.password) {
    if (!isPasswordValid(body.password)) throw createError({ statusCode: 400, statusMessage: 'password must be 8-1024 characters' })
    patch.passHash = await hashPassword(body.password)
  }

  updateUser(id, patch)
  if (patch.passHash) deleteUserSessions(id, event.context.sessionTokenHash as string | undefined ?? null)
  const { pass_hash: _passHash, ...safe } = getUserById(id)!
  return safe
})
