// Smoke test for config.json loading (defaults, partial files, invalid input).
// Run: node test/config.test.mjs
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { CONFIG_DEFAULTS, isGitlabReady, loadConfig } from '../server/utils/config.ts'

let failed = 0
function check (name, cond) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`)
  if (!cond) failed++
}

const dir = mkdtempSync(join(tmpdir(), 'monstrata-config-test-'))
const file = join(dir, 'config.json')
process.env.MONSTRATA_CONFIG = file

// the loader caches by file mtime - pause between writes so they differ
async function write (text) {
  await sleep(10)
  writeFileSync(file, text)
}

await write(JSON.stringify({ auth: { enabled: true } }))
let cfg = loadConfig()
check('auth.enabled from file', cfg.auth.enabled === true)
check('missing db.path falls back to default', cfg.db.path === CONFIG_DEFAULTS.db.path)
check('gitlab off by default', cfg.auth.gitlab.enabled === false && !isGitlabReady(cfg))

await write(JSON.stringify({
  auth: { enabled: true, gitlab: { enabled: true, baseUrl: 'http://gitlab.lan/', clientId: ' cid ', clientSecret: 'sec', allowedGroups: ['ops', '', 42] } }
}))
cfg = loadConfig()
check('gitlab fields parsed', cfg.auth.gitlab.enabled === true && cfg.auth.gitlab.clientId === 'cid' && isGitlabReady(cfg))
check('gitlab baseUrl trimmed of slashes', cfg.auth.gitlab.baseUrl === 'http://gitlab.lan')
check('gitlab allowedGroups filtered to strings', JSON.stringify(cfg.auth.gitlab.allowedGroups) === '["ops"]')

await write(JSON.stringify({ auth: { enabled: true, gitlab: { enabled: true, baseUrl: 'http://gitlab.lan', clientId: 'cid' } } }))
cfg = loadConfig()
check('gitlab without secret is not ready', !isGitlabReady(cfg))

await write(JSON.stringify({ auth: { enabled: false, gitlab: { enabled: true, baseUrl: 'http://gitlab.lan', clientId: 'cid', clientSecret: 'sec' } } }))
cfg = loadConfig()
check('gitlab needs auth.enabled to be ready', !isGitlabReady(cfg))

await write(JSON.stringify({ db: { path: 'x/other.db' }, auth: { enabled: false } }))
cfg = loadConfig()
check('db.path from file', cfg.db.path === 'x/other.db' && cfg.auth.enabled === false)

await write(JSON.stringify({ db: { path: 42 }, auth: { enabled: 'yes' } }))
cfg = loadConfig()
check('wrong types fall back to defaults', cfg.db.path === CONFIG_DEFAULTS.db.path && cfg.auth.enabled === false)

const errLog = console.error
console.error = () => { /* expected parse error */ }
await write('not json {{{')
cfg = loadConfig()
check('invalid json falls back to defaults', cfg.db.path === CONFIG_DEFAULTS.db.path && cfg.auth.enabled === false)
console.error = errLog

process.env.MONSTRATA_CONFIG = join(dir, 'does-not-exist.json')
cfg = loadConfig()
check('missing file uses defaults', cfg.db.path === CONFIG_DEFAULTS.db.path && cfg.auth.enabled === false)

rmSync(dir, { recursive: true, force: true })
console.log(failed === 0 ? '\nAll checks passed' : `\n${failed} checks FAILED`)
process.exitCode = failed > 0 ? 1 : 0
