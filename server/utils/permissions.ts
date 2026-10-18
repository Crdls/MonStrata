/**
 * Pure authorization rules — no imports, reachable from bare Node like
 * credentials.ts so tests can drive them directly (see test/auth.test.mjs).
 */

export interface Actor {
  /** signed-in user id, undefined while auth is disabled */
  userId?: number
  /** 'admin' | 'user', undefined while auth is disabled */
  userRole?: string
}

/**
 * Who may edit/delete a server: while auth is off everybody; otherwise the
 * creator or an admin. Servers with an unknown author are admin-only.
 */
export function canManageServer (authEnabled: boolean, actor: Actor, server: { created_by: number | null }): boolean {
  if (!authEnabled) return true
  if (actor.userRole === 'admin') return true
  return server.created_by != null && server.created_by === actor.userId
}

/**
 * True when this edit would strip an active admin. Admins manage each other,
 * so the caller must refuse such edits while only one active admin remains
 * (see countActiveAdmins in db.ts). Deleting a user is treated as disabling
 * them: pass `{ disabled: true }` as the patch.
 */
export function demotesActiveAdmin (
  target: { role: string, disabled: number | boolean },
  patch: { role?: string, disabled?: boolean }
): boolean {
  if (target.role !== 'admin' || Boolean(target.disabled)) return false
  return patch.role === 'user' || patch.disabled === true
}
