import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadConfig } from './config.ts'

export interface ServerRow {
  id: number
  name: string
  url: string
  enabled: number
  created_at: number
}

export interface UserRow {
  id: number
  username: string
  pass_hash: string
  role: string
  created_at: number
  last_login: number | null
}

export interface SessionUserRow {
  token_hash: string
  user_id: number
  expires_at: number
  username: string
  role: string
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
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  pass_hash  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL,
  last_login INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
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
    // config.json db.path (relative resolves from the project root);
    // applied at startup - restart after changing it
    const path = resolve(loadConfig().db.path)
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

// ---------- users ----------

export function countUsers (): number {
  return (useDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
}

export function getUserById (id: number): UserRow | null {
  return useDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | null
}

export function getUserByUsername (username: string): UserRow | null {
  return useDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | null
}

export function createUser (username: string, passHash: string): UserRow {
  const info = useDb()
    .prepare('INSERT INTO users (username, pass_hash, role, created_at) VALUES (?, ?, ?, ?)')
    .run(username, passHash, 'admin', Date.now())
  return getUserById(Number(info.lastInsertRowid))!
}

export function updatePassword (userId: number, passHash: string): void {
  useDb().prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(passHash, userId)
}

export function touchLastLogin (userId: number): void {
  useDb().prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), userId)
}

// ---------- sessions ----------

export function createSession (tokenHash: string, userId: number, expiresAt: number): void {
  useDb()
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash, userId, Date.now(), expiresAt)
}

export function getSessionUser (tokenHash: string): SessionUserRow | null {
  return useDb()
    .prepare(`SELECT s.token_hash, s.user_id, s.expires_at, u.username, u.role
              FROM sessions s JOIN users u ON u.id = s.user_id
              WHERE s.token_hash = ?`)
    .get(tokenHash) as SessionUserRow | null
}

export function extendSession (tokenHash: string, expiresAt: number): void {
  useDb().prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(expiresAt, tokenHash)
}

export function deleteSession (tokenHash: string): void {
  useDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}

/** Sign a user's sessions out; pass `exceptTokenHash` to keep the current one. */
export function deleteUserSessions (userId: number, exceptTokenHash: string | null = null): void {
  useDb()
    .prepare('DELETE FROM sessions WHERE user_id = ? AND (? IS NULL OR token_hash <> ?)')
    .run(userId, exceptTokenHash, exceptTokenHash)
}

export function purgeExpiredSessions (now: number): void {
  useDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
}
