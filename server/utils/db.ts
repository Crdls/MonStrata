import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export interface ServerRow {
  id: number
  name: string
  url: string
  enabled: number
  created_at: number
}

export interface Settings {
  scrapeIntervalS: number
  rollupIntervalS: number
  rawRetentionH: number
  hourlyRetentionD: number
}

export const SETTINGS_DEFAULTS: Settings = {
  scrapeIntervalS: 10,
  rollupIntervalS: 30,
  rawRetentionH: 48,
  hourlyRetentionD: 400
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS servers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL UNIQUE,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS server_status (
  server_id INTEGER NOT NULL,
  ts        INTEGER NOT NULL,
  up        INTEGER NOT NULL,
  error     TEXT
);
CREATE TABLE IF NOT EXISTS samples (
  server_id INTEGER NOT NULL,
  ts        INTEGER NOT NULL,
  metric    TEXT NOT NULL,
  labels    TEXT NOT NULL DEFAULT '',
  value     REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_samples_lookup ON samples (server_id, metric, ts);
CREATE TABLE IF NOT EXISTS rollup_hourly (
  server_id INTEGER NOT NULL,
  hour      INTEGER NOT NULL,
  metric    TEXT NOT NULL,
  labels    TEXT NOT NULL DEFAULT '',
  avg       REAL NOT NULL,
  max       REAL NOT NULL,
  min       REAL NOT NULL,
  n         INTEGER NOT NULL,
  PRIMARY KEY (server_id, hour, metric, labels)
);
CREATE TABLE IF NOT EXISTS rollup_daily (
  server_id INTEGER NOT NULL,
  day       INTEGER NOT NULL,
  metric    TEXT NOT NULL,
  labels    TEXT NOT NULL DEFAULT '',
  avg       REAL NOT NULL,
  max       REAL NOT NULL,
  min       REAL NOT NULL,
  n         INTEGER NOT NULL,
  PRIMARY KEY (server_id, day, metric, labels)
);
`

let db: Database.Database | null = null

export function useDb (): Database.Database {
  if (!db) {
    const path = process.env.STRATAMON_DB || resolve(process.cwd(), 'data/stratamon.db')
    mkdirSync(dirname(path), { recursive: true })
    db = new Database(path)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.exec(SCHEMA)
  }
  return db
}

export function getSettings (): Settings {
  const rows = useDb().prepare('SELECT key, value FROM settings').all() as Array<{ key: string, value: string }>
  const stored = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    scrapeIntervalS: Number(stored.scrape_interval_s ?? SETTINGS_DEFAULTS.scrapeIntervalS),
    rollupIntervalS: Number(stored.rollup_interval_s ?? SETTINGS_DEFAULTS.rollupIntervalS),
    rawRetentionH: Number(stored.raw_retention_h ?? SETTINGS_DEFAULTS.rawRetentionH),
    hourlyRetentionD: Number(stored.hourly_retention_d ?? SETTINGS_DEFAULTS.hourlyRetentionD)
  }
}

export function saveSettings (patch: Partial<Settings>): Settings {
  const stmt = useDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  const map: Record<keyof Settings, string> = {
    scrapeIntervalS: 'scrape_interval_s',
    rollupIntervalS: 'rollup_interval_s',
    rawRetentionH: 'raw_retention_h',
    hourlyRetentionD: 'hourly_retention_d'
  }
  for (const key of Object.keys(map) as Array<keyof Settings>) {
    if (patch[key] !== undefined) stmt.run(map[key], String(patch[key]))
  }
  return getSettings()
}
