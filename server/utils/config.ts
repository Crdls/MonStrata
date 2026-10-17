import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { runtime } from './runtime.ts'

/**
 * System-level settings kept in `config.json` next to the project root —
 * unlike the scrape settings in the DB these are intentionally NOT editable
 * from the UI (you need filesystem access to change them, see README).
 * This file is reachable from bare Node (via db.ts), keep relative imports
 * with explicit `.ts` extensions.
 */
export interface GitlabAuth {
  enabled: boolean
  /** base URL of the GitLab server without a trailing slash, e.g. http://gitlab.lan */
  baseUrl: string
  clientId: string
  clientSecret: string
  /** OAuth callback override; empty = derived from the incoming request */
  redirectUri: string
  /** GitLab groups whose members may sign in (subgroups inherit); empty = any user */
  allowedGroups: string[]
}

export interface AppConfig {
  db: {
    /** SQLite file; relative paths resolve from the project root (cwd) */
    path: string
  }
  auth: {
    enabled: boolean
    gitlab: GitlabAuth
  }
}

export const CONFIG_DEFAULTS: AppConfig = {
  db: { path: 'data/monstrata.db' },
  auth: {
    enabled: false,
    gitlab: { enabled: false, baseUrl: '', clientId: '', clientSecret: '', redirectUri: '', allowedGroups: [] }
  }
}

export function configPath (): string {
  return process.env.MONSTRATA_CONFIG || resolve(process.cwd(), 'config.json')
}

function str (raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseGitlab (raw: unknown): GitlabAuth {
  const g = raw as Record<string, unknown> | undefined
  return {
    enabled: g?.enabled === true,
    baseUrl: str(g?.baseUrl).replace(/\/+$/, ''),
    clientId: str(g?.clientId),
    clientSecret: str(g?.clientSecret),
    redirectUri: str(g?.redirectUri),
    allowedGroups: Array.isArray(g?.allowedGroups)
      ? (g.allowedGroups as unknown[]).map(str).filter(s => s !== '')
      : []
  }
}

/** GitLab sign-in actually usable: auth on + gitlab on + all required fields set. */
export function isGitlabReady (cfg: AppConfig): boolean {
  const g = cfg.auth.gitlab
  return cfg.auth.enabled && g.enabled && g.baseUrl !== '' && g.clientId !== '' && g.clientSecret !== ''
}

export function parseConfig (text: string | null): AppConfig {
  if (!text) return CONFIG_DEFAULTS
  try {
    const raw = JSON.parse(text) as { db?: { path?: unknown }, auth?: { enabled?: unknown, gitlab?: unknown } }
    const path = typeof raw?.db?.path === 'string' && raw.db.path.trim() ? raw.db.path.trim() : CONFIG_DEFAULTS.db.path
    return { db: { path }, auth: { enabled: raw?.auth?.enabled === true, gitlab: parseGitlab(raw?.auth?.gitlab) } }
  } catch (err) {
    console.error('[monstrata] could not parse config.json, using defaults:', err)
    return CONFIG_DEFAULTS
  }
}

/**
 * Read `config.json` from the project root. The file is optional — when it is
 * missing or invalid we fall back to the defaults. The cached value is
 * reloaded whenever the file mtime changes, so `auth.enabled` edits apply
 * without a restart (`db.path` is applied only when the DB opens at startup).
 */
export function loadConfig (): AppConfig {
  const rt = runtime()
  let mtime = 0
  try {
    mtime = statSync(configPath()).mtimeMs
  } catch { /* no config file */ }
  const cache = rt.config
  if (!cache || cache.mtime !== mtime) {
    let text: string | null = null
    if (mtime > 0) {
      try {
        text = readFileSync(configPath(), 'utf8')
      } catch (err) {
        console.error('[monstrata] could not read config.json, using defaults:', err)
      }
    }
    rt.config = { mtime, value: parseConfig(text) }
  }
  return rt.config.value
}
