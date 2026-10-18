import { readFileSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { resolve } from 'node:path'
import { rootCertificates } from 'node:tls'
import type { GitlabAuth } from './config.ts'

/**
 * Fetch for the GitLab OAuth requests with the config-controlled TLS options
 * (auth.gitlab.caCert / auth.gitlab.insecureTls). Node's global fetch cannot
 * relax certificate verification per request, so https URLs that need it go
 * through node:https instead; everything else uses plain fetch unchanged.
 * Keep relative imports with explicit `.ts` extensions (bare-Node reachable,
 * like gitlab.ts).
 */

export interface GitlabFetchInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs: number
}

export interface GitlabFetchResult {
  ok: boolean
  status: number
  text: string
}

const MAX_REDIRECTS = 3

export async function gitlabFetch (url: string, init: GitlabFetchInit, gl: GitlabAuth): Promise<GitlabFetchResult> {
  const target = new URL(url)
  const customTls = target.protocol === 'https:' && (gl.insecureTls || gl.caCert !== '')
  if (!customTls) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs) })
    return { ok: res.ok, status: res.status, text: await res.text() }
  }
  let next = target
  for (let redirects = 0; ; redirects++) {
    const res = await httpsFetch(next, init, gl)
    const location = redirects < MAX_REDIRECTS ? res.location : null
    if (!location) return res
    next = new URL(location, next)
  }
}

function httpsFetch (target: URL, init: GitlabFetchInit, gl: GitlabAuth): Promise<GitlabFetchResult & { location: string | null }> {
  return new Promise((resolvePromise, reject) => {
    const req = httpsRequest({
      hostname: target.hostname,
      port: target.port ? Number(target.port) : 443,
      path: target.pathname + target.search,
      method: init.method ?? 'GET',
      headers: init.headers,
      timeout: init.timeoutMs,
      rejectUnauthorized: !gl.insecureTls,
      // trust the configured CA on top of Node's built-in ones when asked
      ...(gl.caCert ? { ca: [...rootCertificates, readFileSync(resolve(gl.caCert))] } : {})
    }, res => {
      const chunks: Buffer[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const code = res.statusCode ?? 0
        resolvePromise({
          ok: code >= 200 && code < 300,
          status: code,
          text: Buffer.concat(chunks).toString('utf8'),
          location: code >= 300 && code < 400 ? res.headers.location ?? null : null
        })
      })
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error(`GitLab request timed out: ${target.href}`)))
    req.on('error', reject)
    if (init.body) req.write(init.body)
    req.end()
  })
}
