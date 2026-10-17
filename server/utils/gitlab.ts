import { randomBytes } from 'node:crypto'
import type { GitlabAuth } from './config.ts'

/**
 * Pure GitLab OAuth2 helpers (authorization code flow, plain REST, no deps).
 * Reachable from bare Node like credentials.ts — keep relative imports with
 * explicit `.ts` extensions. The routes do the fetching; the responses are
 * parsed here so tests can feed them canned JSON (see test/auth.test.mjs).
 */

/** CSRF/state nonce for the OAuth redirect round-trip. */
export function newOAuthState (): string {
  return randomBytes(24).toString('base64url')
}

export function authorizeUrl (gl: GitlabAuth, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: gl.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'read_user'
  })
  return `${gl.baseUrl}/oauth/authorize?${q.toString()}`
}

export function tokenRequestBody (gl: GitlabAuth, code: string, redirectUri: string): string {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: gl.clientId,
    client_secret: gl.clientSecret,
    code,
    redirect_uri: redirectUri
  }).toString()
}

export function tokenFromResponse (text: string): string | null {
  try {
    const token = (JSON.parse(text) as { access_token?: unknown }).access_token
    return typeof token === 'string' && token !== '' ? token : null
  } catch {
    return null
  }
}

export function usernameFromUserResponse (text: string): string | null {
  try {
    const user = JSON.parse(text) as { username?: unknown }
    return typeof user.username === 'string' && user.username !== '' ? user.username : null
  } catch {
    return null
  }
}

/** Full paths of the groups from a /api/v4/groups response, lowercased. */
export function pathsFromGroupsResponse (text: string): string[] {
  try {
    const rows = JSON.parse(text) as Array<{ full_path?: unknown }>
    if (!Array.isArray(rows)) return []
    return rows.map(r => str(r?.full_path).toLowerCase()).filter(p => p !== '')
  } catch {
    return []
  }
}

/**
 * True when the user is a member of one of the configured groups. Membership
 * is inherited, so belonging to `ops/api` also satisfies the `ops` config.
 */
export function isGroupAllowed (allowedGroups: string[], memberPaths: string[]): boolean {
  return allowedGroups.some(allowed => {
    const group = str(allowed).toLowerCase()
    if (group === '') return false
    return memberPaths.some(p => p === group || p.startsWith(`${group}/`))
  })
}

function str (raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}
