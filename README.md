# MonStrata

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
  queue, VRAM %, power, hit rate, etc.). Period and metric are remembered
  per browser (cookie).
- **Settings** — poller interval and rollup interval (30 s by default),
  retention depth for raw data and hourly aggregates. Applied on the fly.
- **Theme** — light / dark / system: quick toggle in the header or a
  selector in Settings; accent and neutral palettes selectable in
  Settings; stored per browser (localStorage).
- **i18n** — UI in English, Russian, German, Spanish, French and Chinese;
  language is detected from the browser and switched in the header
  (stored in the `monstrata_locale` cookie). Strings live in
  `i18n/locales/*.json`, a new language = one JSON file + an entry in
  `nuxt.config.ts`.
- **Optional authentication** — enable `auth.enabled` in `config.json`;
  accounts live in SQLite with scrypt-hashed passwords and 30-day sliding
  sessions, with `admin`/`user` roles. With auth on and no users yet, the app
  opens a first-run screen to create the admin account. Users can also sign
  in through a GitLab server on the LAN (OAuth2, see
  [Authentication](#authentication)).

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

The database is a SQLite file `data/monstrata.db` (created automatically).
Its path can be changed with `db.path` in `config.json` (applied at startup).
System settings live in `config.json` in the project root — see
[Authentication](#authentication).

## Authentication

System-level settings live in `config.json` next to the project root — copy
`config.json.example` to `config.json`:

```json
{
  "db": { "path": "data/monstrata.db" },
  "auth": { "enabled": true }
}
```

The file is optional (absent = defaults: `data/monstrata.db`, auth off).
`auth.enabled` applies as soon as the file changes; `db.path` applies at
startup — restart after changing it (relative paths resolve from the project
root). Unlike the Settings page, these switches intentionally require
filesystem access — auth cannot be turned off from the web UI.

With auth enabled:

- no users yet → the app opens a first-run screen to create the admin account;
- every API route and the WebSocket require the `monstrata_session` cookie
  (HttpOnly, scrypt-hashed passwords in SQLite, sessions live 30 days and
  slide on use);
- two roles: `admin` and `user`; admins get a **Users** page where they can
  change roles, assign a new password to anybody (without knowing the old
  one), freeze accounts (frozen users cannot sign in and their active
  sessions are dropped) and delete users — the last active admin can never
  be demoted, frozen or deleted, and nobody can demote or freeze themselves;
- servers remember who added them: editing, deleting and toggling a server
  is allowed to its creator and to admins only (with auth off everybody
  may do everything, as before);
- sign out in the header; the Settings page can change your own password
  (the current session stays signed in, others are signed out).

### Sign in with GitLab

Instead of (or next to) local passwords you can authenticate against a
GitLab server on your LAN with OAuth2 (authorization code, scope
`read_user`) — no extra service needed:

1. In GitLab create an OAuth application (your profile → Applications, or
   Admin Area → Applications to offer it to everyone) with the redirect URI
   `http://<monstrata-host>:3003/api/auth/gitlab/callback` and the
   `read_user` scope;
2. put the application id/secret into `config.json`:

```json
"auth": {
  "enabled": true,
  "gitlab": {
    "enabled": true,
    "baseUrl": "http://gitlab.lan",
    "clientId": "…",
    "clientSecret": "…",
    "allowedGroups": []
  }
}
```

- the login page gains a "Sign in with GitLab" button;
- the first GitLab sign-in creates a local user with the same username and
  the admin role (it can only happen while no users exist); later GitLab
  sign-ins are created as plain `user` accounts — an admin promotes them on
  the Users page; new GitLab users carry a "GitLab" badge, have no password
  and can set a local one in Settings (the card asks for a new password
  only, no current one) to keep signing in when GitLab is down;
- `allowedGroups` (optional) restricts sign-in to members of those GitLab
  groups; members of subgroups count too; an empty list lets any GitLab
  user of that server sign in;
- `redirectUri` (optional) overrides the callback URL derived from the
  request — you only need it behind a reverse proxy that rewrites the host.

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
  pages/        dashboard, server, heatmap, servers, users, settings, login
  components/   ServerCard, MetricChart (uPlot), LoadHeatmap, ...
  plugins/live.ts  shared state + WebSocket client
i18n/locales/   dictionaries: en, ru, de, es, fr, zh
server/
  middleware/   auth.ts - session gate for /api (opt-in via config.json)
  utils/        Prometheus parser, SQLite, metric catalog, scraper, rollups,
                auth primitives, permission rules, GitLab OAuth helpers
  plugins/      background loops (scrape, rollups)
  api/          servers CRUD, live, range, heatmap, settings, auth, users
  routes/_ws.ts WebSocket endpoint
scripts/        reset-password.mjs - lost password recovery (no email)
test/           parser test on real /metrics fixtures + auth helper tests
```

## API

- `GET|POST /api/servers`, `PATCH|DELETE /api/servers/:id`, `POST /api/servers/:id/ping` (PATCH/DELETE: creator or admin only when auth is on)
- `GET /api/live` — current snapshots of all servers
- `GET /api/range?serverId&metric&from&to` — metric history (raw/hourly/daily — the source is picked automatically)
- `GET /api/heatmap?metric&period=1h|3h|12h|24h|7d|30d|1y` — servers × buckets matrix
- `GET|PUT /api/settings`
- `/api/auth/status|setup|login|logout|password`, `/api/auth/gitlab/start|callback` — auth (public: status, setup, login, logout, gitlab/*)
- `GET /api/users`, `PATCH|DELETE /api/users/:id` — user management (admins only; PATCH takes `role`, `disabled`, `password`)
- `WS /_ws` — push snapshots

## Tests

```sh
node test/parse.test.mjs
node test/auth.test.mjs
node test/config.test.mjs
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
