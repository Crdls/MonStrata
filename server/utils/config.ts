import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { runtime } from './runtime'

/**
 * System-level settings kept in `config.json` next to the project root —
 * unlike the scrape settings in the DB these are intentionally NOT editable
 * from the UI (you need filesystem access to change them, see README).
 */
export interface AppConfig {
  auth: {
    enabled: boolean
  }
}

export const CONFIG_DEFAULTS: AppConfig = {
  auth: { enabled: false }
}

export function configPath (): string {
  return process.env.STRATAMON_CONFIG || resolve(process.cwd(), 'config.json')
}

function parseConfig (text: string | null): AppConfig {
  if (!text) return CONFIG_DEFAULTS
  try {
    const raw = JSON.parse(text) as { auth?: { enabled?: unknown } }
    return { auth: { enabled: raw?.auth?.enabled === true } }
  } catch (err) {
    console.error('[stratamon] could not parse config.json, using defaults:', err)
    return CONFIG_DEFAULTS
  }
}

/**
 * Read `config.json` from the project root. The file is optional — when it is
 * missing or invalid we fall back to the defaults (auth disabled). The cached
 * value is reloaded whenever the file mtime changes, so edits apply without a
 * restart.
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
        console.error('[stratamon] could not read config.json, using defaults:', err)
      }
    }
    rt.config = { mtime, value: parseConfig(text) }
  }
  return rt.config.value
}
