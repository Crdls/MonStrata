import {
  isGroupAllowed, pathsFromGroupsResponse, tokenFromResponse, tokenRequestBody, usernameFromUserResponse
} from '../../../utils/gitlab'
import { isGitlabReady, loadConfig } from '../../../utils/config'
import { normalizeUsername, startSession } from '../../../utils/auth'
import { runtime } from '../../../utils/runtime'
import { countUsers, createUser, getUserByUsername, touchLastLogin } from '../../../utils/db'

// GitLab OAuth callback: verify state, exchange the code for a token, read
// the GitLab user, find-or-create the local user and open a session.
// Every failure goes back to /login?error=gitlab[-forbidden].
const FETCH_TIMEOUT_MS = 10_000

export default defineEventHandler(async (event) => {
  const fail = (why: string) => sendRedirect(event, `/login?error=${why}`)
  const cfg = loadConfig()
  const gl = cfg.auth.gitlab
  if (!isGitlabReady(cfg)) return fail('gitlab')

  const query = getQuery(event)
  const state = String(query.state ?? '')
  const code = String(query.code ?? '')
  const states = runtime().gitlabStates
  const expiresAt = states.get(state)
  states.delete(state) // single-use
  if (!code || query.error || !expiresAt || expiresAt <= Date.now()) return fail('gitlab')

  const redirectUri = gl.redirectUri || `${getRequestURL(event).origin}/api/auth/gitlab/callback`
  try {
    const tokenRes = await fetch(`${gl.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenRequestBody(gl, code, redirectUri),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!tokenRes.ok) return fail('gitlab')
    const accessToken = tokenFromResponse(await tokenRes.text())
    if (!accessToken) return fail('gitlab')

    const userRes = await fetch(`${gl.baseUrl}/api/v4/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!userRes.ok) return fail('gitlab')
    const username = normalizeUsername(usernameFromUserResponse(await userRes.text()))
    if (!username) return fail('gitlab')

    if (gl.allowedGroups.length > 0) {
      const groupsRes = await fetch(`${gl.baseUrl}/api/v4/groups?membership=true&all=true&per_page=100`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })
      // unreachable groups API = deny, the restriction was asked for
      const paths = groupsRes.ok ? pathsFromGroupsResponse(await groupsRes.text()) : []
      if (!isGroupAllowed(gl.allowedGroups, paths)) return fail('gitlab-forbidden')
    }

    // empty pass_hash: no local password yet, Settings offers to set one;
    // the very first sign-up gets the admin role, later GitLab users are plain users
    const user = getUserByUsername(username) ?? createUser(username, '', countUsers() === 0 ? 'admin' : 'user', true)
    if (user.disabled) return fail('gitlab-forbidden')
    touchLastLogin(user.id)
    startSession(event, user.id)
    return sendRedirect(event, '/')
  } catch (err) {
    console.error('[monstrata] GitLab sign-in failed:', err)
    return fail('gitlab')
  }
})
