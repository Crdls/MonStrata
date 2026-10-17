# AGENTS.md

StrataMon: Nuxt 4 monitor for Strata inference engines. Scrapes Prometheus `/metrics` from several servers into SQLite; serves a live dashboard (WebSocket + polling fallback), metric history with rollups, a load heatmap, and i18n.

## Commands

- `npm run dev` — dev server on http://localhost:3003 (port set via `devServer.port` in `nuxt.config.ts`).
- The dev server is usually already running by the user on :3003 — check `http://localhost:3003` before starting another one; don't kill or restart it without being asked.
- `node test/parse.test.mjs` and `node test/auth.test.mjs` — the entire test suite. Bare Node scripts, no test framework; they import `.ts` directly, so type-stripping-capable Node is required (README: Node ≥ 22.22 or ≥ 24.15; older Node 24 prints EBADENGINE).
- `npm run build && node .output/server/index.mjs` — production run. `npm run build` is the only whole-project validation: there is **no** lint, formatter, typecheck script, or CI. Match existing style (2 spaces, no semicolons, single quotes, `foo (args)` space before parens).
- Test fixtures are real `/metrics` captures in `test/fixtures/`.

## Architecture

- Nuxt 4 layout: frontend in `app/`, Nitro backend in `server/` (file-based API in `server/api/`, WS route `server/routes/_ws.ts`).
- Background loops are Nitro plugins (`server/plugins/scraper.ts`, `rollups.ts`) driving `server/utils/scheduler.ts`: self-rescheduling `setTimeout` that re-reads intervals from the DB every cycle, so settings changes apply without restart (`settings.put.ts` also calls `schedule*` directly).
- All process-wide server state lives on `globalThis.__stratamon` via `server/utils/runtime.ts` so dev HMR doesn't duplicate timers or lose counter baselines. Add new background state there, never in module-local variables.
- SQLite via better-sqlite3 (synchronous API), file `data/stratamon.db` (gitignored, auto-created; override with `STRATAMON_DB`). Schema is inline `CREATE ... IF NOT EXISTS` DDL in `server/utils/db.ts` — there is **no migration system**, so schema changes must be idempotent and existing dev DBs updated by hand.
- Storage tiers: `samples` (raw, ~10 s, 48 h) → `rollup_hourly` (400 d) → `rollup_daily` (forever). `/api/range` picks the tier itself from row counts; `server/utils/rollup.ts` is idempotent (recomputes last 3 h / 3 d) and also performs retention deletes.
- Frontend live state is one shared plugin (`app/plugins/live.ts`, accessed via `useLive()`); pages must not open their own WebSocket.
- Auth is opt-in via `config.json` (`server/utils/config.ts`, path overridable with `STRATAMON_CONFIG`; missing file = off; reloaded on mtime change, never write it from app code). `server/middleware/auth.ts` gates `/api/*` (public allowlist in `OPEN_AUTH_PATHS`; `/api/auth/password` requires a session) and `/_ws` checks the cookie in its own `open()` handler (WS upgrades bypass middleware). Frontend gate: `app/middleware/auth.global.ts` + `useAuth()`; SSR pages that fetch `/api` must forward cookies (`headers: useRequestHeaders(['cookie'])`).
- Users/sessions are SQLite tables (db.ts); passwords are scrypt hashes. `server/utils/credentials.ts` holds the pure primitives (hash/token/cookie) and must not import other utils — bare Node tests and `scripts/reset-password.mjs` import it directly (relative imports there need explicit `.ts` extensions; extensionless imports break plain Node loading).

## Metrics

- `server/utils/metrics.ts` is the single catalog: every stored/displayed metric needs a `MetricDef` (label/unit/agg); heatmap selector lists are driven by `heatmap: true`.
- Raw `vllm:*` / `strata:*` series are stored verbatim; `derived:*` series are computed by the scraper (`server/utils/scrape.ts`) from counter deltas using `COUNTER_RATES` / `HIST_WINDOW_AVG` / `BUSY_PCT`. Define new derived metrics there, not in API routes or the frontend.
- Label sets are stored as `normalizeLabels()` strings (sorted `k=v`, comma-joined) — always normalize before keying or comparing.
- Scraping `/metrics` must send `Accept: text/plain`; Strata returns JSON otherwise.

## i18n

- Six locales in `i18n/locales/*.json`; `en.json` is canonical and all six are currently key-synced — add every new UI string to all six files. A new language = one JSON file + entry in `nuxt.config.ts` (strategy `no_prefix`, cookie `stratamon_locale`).

## nuxt.config.ts — do not remove these nitro workarounds

- `externals.inline` of the Nuxt renderer: Windows-only workaround for nuxt/nuxt#36467; without it all SSR returns 500.
- `experimental.websocket: true`: required for the `/_ws` upgrade in dev and prod.
- `external: ['better-sqlite3']`: the native module must not be bundled.
- `ui.fonts: false`: no network font fetch at build time.

## Conventions

- Auth is off by default and must stay that way (trusted LAN service) — don't enable it in code/config defaults or force it on.
- README is English by default (`README.md`); translations are `docs/README.ru.md` and `docs/README.zh.md` — each starts with a language-switch line of relative links. Keep all three in sync when editing. User-facing docs are in Russian; code comments in English; commit messages are plain English imperatives (no conventional-commit prefixes).
- After any change that affects user-visible behavior, setup, ports, commands, or architecture, update `README.md` in the same task to keep it accurate.
