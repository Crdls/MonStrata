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
- No authentication — the service is meant for a trusted local network.

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
  pages/        dashboard, server, heatmap, servers, settings
  components/   ServerCard, MetricChart (uPlot), LoadHeatmap, ...
  plugins/live.ts  shared state + WebSocket client
i18n/locales/   dictionaries: en, ru, de, es, fr, zh
server/
  utils/        Prometheus parser, SQLite, metric catalog, scraper, rollups
  plugins/      background loops (scrape, rollups)
  api/          servers CRUD, live, range, heatmap, settings
  routes/_ws.ts WebSocket endpoint
test/           parser test on real /metrics fixtures
```

## API

- `GET|POST /api/servers`, `PATCH|DELETE /api/servers/:id`, `POST /api/servers/:id/ping`
- `GET /api/live` — current snapshots of all servers
- `GET /api/range?serverId&metric&from&to` — metric history (raw/hourly/daily — the source is picked automatically)
- `GET /api/heatmap?metric&period=1h|3h|12h|24h|7d|30d|1y` — servers × buckets matrix
- `GET|PUT /api/settings`
- `WS /_ws` — push snapshots

## Tests

```sh
node test/parse.test.mjs
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
- No authentication: the service is for a trusted network and is not
  exposed to the outside.
