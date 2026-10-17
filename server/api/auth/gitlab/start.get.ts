import { authorizeUrl, newOAuthState } from '../../../utils/gitlab'
import { isGitlabReady, loadConfig } from '../../../utils/config'
import { runtime } from '../../../utils/runtime'

// start the GitLab web login (OAuth2 authorization code flow); the state
// nonce lives in runtime state and expires, callback consumes it once
const STATE_TTL_MS = 10 * 60 * 1000

export default defineEventHandler((event) => {
  const cfg = loadConfig()
  if (!isGitlabReady(cfg)) throw createError({ statusCode: 403, statusMessage: 'GitLab sign-in is not configured' })
  const states = runtime().gitlabStates
  const now = Date.now()
  for (const [nonce, expires] of states) if (expires <= now) states.delete(nonce)
  const state = newOAuthState()
  states.set(state, now + STATE_TTL_MS)
  const redirectUri = cfg.auth.gitlab.redirectUri
    || `${getRequestURL(event).origin}/api/auth/gitlab/callback`
  return sendRedirect(event, authorizeUrl(cfg.auth.gitlab, redirectUri, state))
})
