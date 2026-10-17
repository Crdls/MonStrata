# StrataMon

**English** · [Русский](docs/README.ru.md) · [中文](docs/README.zh.md)

Web monitoring for **Strata** inference engines: several servers, a live
dashboard, metric history and a load heatmap with selectable period.

## Features

- **Multiple servers** — add a Strata engine by base URL
  (e.g. `http://192.168.10.76:8000`), metrics are read from `/metrics`
  (Prometheus text format, `Accept: text/plain` header required).
- **Live dashboard** — engine state (idle / reading / generating),
  tok/s, queues, KV cache, per GPU: util / VRAM / temperature / power,
  plus host CPU and RAM. Updates over WebSocket with a polling fallback.
- **History** — charts per server for 1h / 6h / 24h / 7d / 30d.
- **Heatmap** — load of all servers by time buckets, periods of
  1h / 3h / 12h / 24h / 7d / 30d / year, selectable metric (GPU util, CPU, tok/s,
  queue, VRAM %, power, hit rate, etc.).
- **Settings** — poller interval and rollup interval (30 s by default),
  retention depth for raw data and hourly aggregates. Applied on the fly.
- **i18n** — UI in English, Russian, German, Spanish, French and Chinese;
  language is detected from the browser and switched in the header
  (stored in the `stratamon_locale` cookie). Strings live in
  `i18n/locales/*.json`, a new language = one JSON file + an entry in
  `nuxt.config.ts`.
- **Optional authentication** — enable `auth.enabled` in `config.json`;
  accounts live in SQLite with scrypt-hashed passwords and 30-day sliding
  sessions. With auth on and no users yet, the app opens a first-run screen
  to create the admin account.

## Running

```sh
npm install
npm run dev        # http://localhost:3003
```

Production:

```sh
npm run build
node .output/server/index.mjs
```

The database is a SQLite file `data/stratamon.db` (created automatically).
The path can be overridden with the `STRATAMON_DB` variable.
Optional system settings (`config.json`, e.g. enabling authentication)
live in the project root — see [Authentication](#authentication).

## Authentication

System-level settings live in `config.json` next to the project root — copy
`config.json.example` to `config.json` and set:

```json
{ "auth": { "enabled": true } }
```

The file is optional (absent = auth off) and edits apply without a restart.
Unlike the Settings page, these switches intentionally require filesystem
access — auth cannot be turned off from the web UI.

With auth enabled:

- no users yet → the app opens a first-run screen to create the admin account;
- every API route and the WebSocket require the `stratamon_session` cookie
  (HttpOnly, scrypt-hashed passwords in SQLite, sessions live 30 days and
  slide on use);
- sign out in the header; the Settings page can change your own password
  (the current session stays signed in, others are signed out).

Lost password? On the server, from the project root (no email involved,
the server may keep running):

```sh
node scripts/reset-password.mjs --list
node scripts/reset-password.mjs <username or id> [new password]
```

The reset signs all sessions of that user out.

## Data storage

| tier | resolution | default retention |
|---|---|---|
| `samples` | every poller cycle (~10 s) | 48 hours |
| `rollup_hourly` | hourly buckets (avg/max/min) | 400 days |
| `rollup_daily` | daily buckets | forever |

Counters (`*_total`) are turned into rates (`derived:*`) while scraping:
`gen_tok_s`, `prompt_tok_s`, `req_s`, window averages `_sum/_count` for
TTFT / ITL / E2E, engine and memory busy percentages.

## Structure

```
app/            Vue 3 + Nuxt UI frontend
  pages/        dashboard, server, heatmap, servers, settings, login
  components/   ServerCard, MetricChart (uPlot), LoadHeatmap, ...
  plugins/live.ts  shared state + WebSocket client
i18n/locales/   dictionaries: en, ru, de, es, fr, zh
server/
  middleware/   auth.ts - session gate for /api (opt-in via config.json)
  utils/        Prometheus parser, SQLite, metric catalog, scraper, rollups,
                auth primitives
  plugins/      background loops (scrape, rollups)
  api/          servers CRUD, live, range, heatmap, settings, auth
  routes/_ws.ts WebSocket endpoint
scripts/        reset-password.mjs - lost password recovery (no email)
test/           parser test on real /metrics fixtures + auth helper tests
```

## API

- `GET|POST /api/servers`, `PATCH|DELETE /api/servers/:id`, `POST /api/servers/:id/ping`
- `GET /api/live` — current snapshots of all servers
- `GET /api/range?serverId&metric&from&to` — metric history (raw/hourly/daily — the source is picked automatically)
- `GET /api/heatmap?metric&period=1h|3h|12h|24h|7d|30d|1y` — servers × buckets matrix
- `GET|PUT /api/settings`
- `/api/auth/status|setup|login|logout|password` — auth (public: status, setup, login, logout)
- `WS /_ws` — push snapshots

## Tests

```sh
node test/parse.test.mjs
node test/auth.test.mjs
```

## Notes

- Node ≥ 22.22 / 24.15 is required (older Node 24 builds of Nuxt 4.6 may
  complain with EBADENGINE).
- `nuxt.config.ts` contains two important environment workarounds:
  - `nitro.externals.inline` — a Windows-only hack until
    [nuxt/nuxt#36467](https://github.com/nuxt/nuxt/issues/36467) is fixed
    (without it the whole SSR returns 500);
  - `nitro.experimental.websocket: true` — enables the WebSocket upgrade
    attach in the server preset (otherwise `/_ws` works neither in dev
    nor in production).
- Strata's `/metrics` returns JSON without the `Accept: text/plain`
  header — the scraper always sends it.
- Authentication is off by default (the service is meant for a trusted local
  network); when enabled, all `/api` routes except the auth bootstrap ones
  and `/_ws` require a valid session cookie.
