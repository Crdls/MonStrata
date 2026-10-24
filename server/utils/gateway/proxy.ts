import type { ServerRow } from '../db.ts'

/**
 * Upstream forwarding for the /v1 gateway: OpenAI-compatible request in,
 * upstream Response streamed straight back (SSE passes through unbuffered).
 * No Nitro globals — pure fetch, testable and reusable.
 */

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'
])

/** An incoming request as far as forwarding is concerned (body is buffered). */
export interface UpstreamRequest {
  method: string
  path: string
  query: string
  headers: Record<string, string | string[] | undefined>
  body: string | null
}

export function upstreamUrl (server: ServerRow, path: string, query: string): string {
  const base = server.url.trim().replace(/\/+$/, '')
  return query ? `${base}${path}?${query}` : `${base}${path}`
}

/** Copy client headers, swapping in the engine's own API key. */
export function buildUpstreamHeaders (req: UpstreamRequest, server: ServerRow, clientIp: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase()
    if (HOP_BY_HOP.has(lower) || lower === 'host' || lower === 'authorization' || lower === 'accept-encoding') continue
    if (typeof value === 'string') headers[lower] = value
    else if (Array.isArray(value)) headers[lower] = value.join(', ')
  }
  if (server.api_key) headers.authorization = `Bearer ${server.api_key}`
  else delete headers.authorization
  if (req.body != null) headers['content-length'] = String(Buffer.byteLength(req.body))
  else delete headers['content-length']
  headers['x-forwarded-for'] = clientIp
  return headers
}

export function forwardRequest (req: UpstreamRequest, server: ServerRow, clientIp: string, signal: AbortSignal): Promise<Response> {
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (req.body ?? undefined)
  return fetch(upstreamUrl(server, req.path, req.query), {
    method: req.method,
    headers: buildUpstreamHeaders(req, server, clientIp),
    body,
    signal
  })
}

/**
 * Headers to send back to the client: upstream's minus hop-by-hop ones, CORS
 * normalised (the gateway is the origin now), plus debug headers on request.
 */
export function clientResponseHeaders (upstream: Headers, extra?: Record<string, string>): Headers {
  const out = new Headers()
  upstream.forEach((value, name) => {
    const lower = name.toLowerCase()
    if (HOP_BY_HOP.has(lower) || lower === 'access-control-allow-origin' || lower === 'access-control-allow-credentials') return
    out.append(name, value)
  })
  out.set('access-control-allow-origin', '*')
  for (const [name, value] of Object.entries(extra ?? {})) out.set(name, value)
  return out
}

export const CORS_PREFLIGHT_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-session-id, session-id',
  'access-control-max-age': '600'
}

// ---------- usage sniffing ----------

export interface TokenUsage { prompt: number, gen: number }

const USAGE_RE = /"usage"\s*:\s*(\{[^{}]*\})/g

/** Parse the last `usage` object found in a chunk of SSE/JSON text. */
export function parseUsageFrom (text: string): TokenUsage | null {
  let last: RegExpExecArray | null = null
  USAGE_RE.lastIndex = 0
  for (let m = USAGE_RE.exec(text); m !== null; m = USAGE_RE.exec(text)) last = m
  if (!last) return null
  try {
    const obj = JSON.parse(last[1]!) as Record<string, unknown>
    const prompt = typeof obj.prompt_tokens === 'number' ? obj.prompt_tokens : 0
    const gen = typeof obj.completion_tokens === 'number' ? obj.completion_tokens : 0
    if (prompt === 0 && gen === 0) return null
    return { prompt, gen }
  } catch {
    return null
  }
}

/**
 * Pass a response stream through while watching for `usage` in it. Called
 * back once when the stream finishes; without a usage chunk the caller gets
 * the byte count for a chars/4 estimate. Best-effort by design: a client
 * disconnect can skip the callback, token stats are an estimate anyway.
 */
export function sniffUsageStream (
  src: ReadableStream<Uint8Array>,
  onDone: (bytes: number, usage: TokenUsage | null) => void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  let tail = ''
  let bytes = 0
  let found: TokenUsage | null = null
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform (chunk, controller) {
      bytes += chunk.byteLength
      controller.enqueue(chunk)
      tail = (tail + decoder.decode(chunk, { stream: true })).slice(-8192)
      const usage = parseUsageFrom(tail)
      if (usage) found = usage
    },
    flush () {
      onDone(bytes, found)
    }
  })
  return src.pipeThrough(transform)
}
