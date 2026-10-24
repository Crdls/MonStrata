import { createHash } from 'node:crypto'

/**
 * Chat → server affinity. OpenAI requests are stateless, so the "same chat"
 * must be recognised from the request itself. Cascade (agreed design):
 *   1. `X-Session-Id` header — exact, used when the client cooperates;
 *   2. hash of a stable `messages` prefix — conversations grow at the tail,
 *      so hashing system + first N bytes identifies the chat for any client;
 *   3. null — no key, the caller falls back to least-loaded routing.
 *
 * Pure module (node:crypto only), reachable from bare Node tests.
 */

export const SESSION_HEADER = 'x-session-id'

/** how many leading message bytes feed the prefix hash */
const PREFIX_BUDGET = 8192

/** Flatten message `content` (string, or OpenAI parts array) to text. */
function contentToText (content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const part of content) {
      if (typeof part === 'string') parts.push(part)
      else if (part && typeof part === 'object') {
        const text = (part as Record<string, unknown>).text
        if (typeof text === 'string') parts.push(text)
        else parts.push(stableJson(part)) // image_url etc. — structure still matters
      }
    }
    return parts.join('')
  }
  return ''
}

/** Deterministic JSON: sorted object keys, so serialization order can't drift. */
function stableJson (value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`
}

/**
 * Derive the affinity key for a request, or null when nothing identifies the
 * chat. Only the conversation opening — the system message plus the first
 * user message — feeds the hash: that is the part that never changes as the
 * chat grows (turns append to the tail), and it is exactly the prompt prefix
 * whose KV cache blocks are shared. Two chats with an identical opening
 * colliding onto one engine is a feature: their cached prefix is the same.
 * The returned value is a hash (safe as a DB primary key and in logs —
 * the raw header value never gets stored).
 */
export function deriveSessionKey (headerValue: string | null | undefined, body: unknown): string | null {
  if (typeof headerValue === 'string') {
    const id = headerValue.trim()
    if (id.length >= 1 && id.length <= 200) {
      return createHash('sha256').update(`h:${id}`).digest('hex')
    }
  }
  const messages = (body as { messages?: unknown } | null)?.messages
  if (!Array.isArray(messages) || messages.length === 0) return null

  const parts: unknown[] = [messages[0]]
  const firstRole = (messages[0] as Record<string, unknown> | null)?.role
  if (firstRole === 'system' && messages.length > 1) parts.push(messages[1])

  const flat: string[] = []
  for (const message of parts) {
    if (!message || typeof message !== 'object') continue
    const m = message as Record<string, unknown>
    const role = typeof m.role === 'string' ? m.role : ''
    flat.push(`${role}\u0000${contentToText(m.content)}`)
  }
  const opening = flat.join('\u0001').slice(0, PREFIX_BUDGET)
  if (!opening) return null
  return createHash('sha256').update(`p:${opening}`).digest('hex')
}
