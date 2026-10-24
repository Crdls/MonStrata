import type { GatewayClientRow, GatewayClientRowWithStats } from '../db.ts'

/**
 * API view for gateway clients — the token hash never leaves the server,
 * only the non-secret hint. Also where the create/rotate response shape
 * (raw token, shown once) is defined.
 */

export interface GatewayClientView {
  id: number
  name: string
  tokenHint: string
  priority: string
  debug: boolean
  enabled: boolean
  createdAt: number
  requestsTotal: number
  errorsTotal: number
  tokensTotal: number
  requestsToday: number
}

export function clientView (c: GatewayClientRowWithStats): GatewayClientView {
  return {
    id: c.id,
    name: c.name,
    tokenHint: c.token_hint,
    priority: c.priority,
    debug: c.debug === 1,
    enabled: c.enabled === 1,
    createdAt: c.created_at,
    requestsTotal: c.requests_total,
    errorsTotal: c.errors_total,
    tokensTotal: c.tokens_total,
    requestsToday: c.requests_today
  }
}

export function clientViewPlain (c: GatewayClientRow): Omit<GatewayClientView, 'requestsTotal' | 'errorsTotal' | 'tokensTotal' | 'requestsToday'> {
  return {
    id: c.id,
    name: c.name,
    tokenHint: c.token_hint,
    priority: c.priority,
    debug: c.debug === 1,
    enabled: c.enabled === 1,
    createdAt: c.created_at
  }
}
