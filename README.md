# StrataMon

Web-мониторинг движков инференса **Strata**: несколько серверов, live-дашборд,
история метрик и тепловая карта загрузки с выбором периода.

## Возможности

- **Несколько серверов** — добавляете Strata-движок по базовому URL
  (например `http://192.168.10.76:8000`), метрики читаются с `/metrics`
  (Prometheus text format, заголовок `Accept: text/plain`).
- **Live-дашборд** — состояние движка (idle / reading / generating),
  tok/s, очереди, KV cache, по каждой GPU: util / VRAM / t° / мощность,
  CPU и RAM хоста. Обновление по WebSocket с fallback на polling.
- **История** — графики по каждому серверу за 1h / 6h / 24h / 7d / 30d.
- **Тепловая карта** — загрузка всех серверов по бакетам времени,
  периоды 24ч / 7д / 30д / год, выбор метрики (GPU util, CPU, tok/s,
  очередь, VRAM %, мощность, hit rate и др.).
- **Настройки** — интервал поллера и интервал роллапа (по умолчанию 30 с),
  глубина хранения raw-данных и часовых агрегатов. Применяются на лету.
- Авторизации нет — сервис рассчитан на доверенную локальную сеть.

## Запуск

```sh
npm install
npm run dev        # http://localhost:3000
```

Продакшен:

```sh
npm run build
node .output/server/index.mjs
```

База — SQLite-файл `data/stratamon.db` (создаётся автоматически).
Путь можно переопределить переменной `STRATAMON_DB`.

## Хранение данных

| слой | разрешение | срок по умолчанию |
|---|---|---|
| `samples` | каждый поллерный цикл (~10 с) | 48 часов |
| `rollup_hourly` | часовые бакеты (avg/max/min) | 400 дней |
| `rollup_daily` | дневные бакеты | бессрочно |

Счётчики (`*_total`) при опросе превращаются в скорости (`derived:*`):
`gen_tok_s`, `prompt_tok_s`, `req_s`, средние по окну `_sum/_count` для
TTFT / ITL / E2E, проценты занятости движка и памяти.

## Структура

```
app/            Vue 3 + Nuxt UI фронтенд
  pages/        dashboard, сервер, heatmap, сервера, настройки
  components/   ServerCard, MetricChart (uPlot), LoadHeatmap, ...
  plugins/live.ts  общий стейт + WebSocket-клиент
server/
  utils/        парсер Prometheus, SQLite, каталог метрик, скрейпер, роллапы
  plugins/      фоновые циклы (scrape, rollups)
  api/          servers CRUD, live, range, heatmap, settings
  routes/_ws.ts WebSocket-эндпоинт
test/           тест парсера на реальных фикстурах (/metrics)
```

## API

- `GET|POST /api/servers`, `PATCH|DELETE /api/servers/:id`, `POST /api/servers/:id/ping`
- `GET /api/live` — текущие снапшоты всех серверов
- `GET /api/range?serverId&metric&from&to` — история метрики (raw/hourly/daily — источник выбирается сам)
- `GET /api/heatmap?metric&period=24h|7d|30d|1y` — матрица серверы × бакеты
- `GET|PUT /api/settings`
- `WS /_ws` — push-снапшоты

## Тесты

```sh
node test/parse.test.mjs
```
