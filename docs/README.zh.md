# MonStrata

[English](../README.md) · [Русский](README.ru.md) · **中文**

**Strata** 推理引擎的 Web 监控系统：多服务器、实时仪表盘、
指标历史，以及可选时间范围的负载热力图。

## 功能

- **多服务器** — 通过基础 URL 添加 Strata 引擎
  （例如 `http://192.168.10.76:8000`），指标从 `/metrics` 读取
  （Prometheus 文本格式，需要 `Accept: text/plain` 请求头）。
- **实时仪表盘** — 引擎状态（idle / reading / generating）、
  tok/s、队列、KV 缓存，每块 GPU：利用率 / 显存 / 温度 / 功耗，
  以及主机 CPU 和内存。通过 WebSocket 更新，并支持轮询回退。
- **历史** — 按服务器查看 1 小时 / 6 小时 / 24 小时 / 7 天 / 30 天图表。
- **热力图** — 所有服务器按时间桶的负载，
  时间范围 1 / 3 / 12 / 24 小时 / 7 天 / 30 天 / 一年，可选指标（GPU 利用率、CPU、
  tok/s、队列、显存 %、功耗、命中率等）。时间范围和指标会在浏览器中记住（cookie）。
- **设置** — 轮询间隔和汇总间隔（默认 30 秒）、
  原始数据和小时聚合的保留深度。修改后立即生效。
- **主题** — 浅色 / 深色 / 跟随系统：页眉中快速切换或在设置中选择，
  设置中还可选择强调色和中性色板，保存在浏览器中（localStorage）。
- **国际化** — 界面支持英语、俄语、德语、西班牙语、法语和中文；
  语言根据浏览器自动检测，可在页眉切换
  （保存在 `monstrata_locale` cookie 中）。文案位于 `i18n/locales/*.json`，
  新增语言 = 一个 JSON 文件 + `nuxt.config.ts` 中的一条配置。
- **可选的身份验证** — 在 `config.json` 中开启 `auth.enabled`；
  账户存储在 SQLite 中，密码使用 scrypt 哈希，登录有效期 30 天并在使用时
  自动续期，角色分为 `admin` 和 `user`。开启验证且尚无任何用户时，应用会打开创建首个管理员账户的界面。
  也可以通过局域网内的 GitLab 服务器登录（OAuth2，见下文「身份验证」）。

## 运行

```sh
npm install
npm run dev        # http://localhost:3003
```

生产环境：

```sh
npm run build
node .output/server/index.mjs
```

数据库是 SQLite 文件 `data/monstrata.db`（自动创建）。
路径可通过 `config.json` 中的 `db.path` 修改（启动时生效）。
系统设置位于项目根目录的 `config.json`，见下文「身份验证」。

## 身份验证

系统设置位于项目根目录的 `config.json` — 将 `config.json.example`
复制为 `config.json`：

```json
{
  "db": { "path": "data/monstrata.db" },
  "auth": { "enabled": true }
}
```

该文件是可选的（不存在 = 默认值：`data/monstrata.db`，验证关闭）。
`auth.enabled` 在文件修改后立即生效；`db.path` 在启动时生效，修改后需重启
（相对路径相对于项目根目录解析）。与设置页面不同，这些设置有意要求
文件系统访问权限 — 无法从 Web 界面关闭身份验证。

开启验证后：

- 尚无任何用户 → 应用打开创建首个管理员账户的界面；
- 所有 API 请求和 WebSocket 都需要 `monstrata_session` cookie
  （HttpOnly，密码为 SQLite 中的 scrypt 哈希，会话有效期 30 天并在使用时续期）；
- 两种角色：`admin` 和 `user`；管理员可见「用户」页面，可在其中更换角色、
  为任何用户指派新密码（无需知道旧密码）、冻结账户（被冻结者无法登录，
  其活动会话立即失效）以及删除用户 — 最后一名活跃管理员不能被降级、冻结
  或删除，任何人都不能降级或冻结自己；
- 服务器会记住创建者：只有创建者和管理员可以编辑、删除和启停服务器
  （验证关闭时所有人照旧可操作）；
- 设置页面中的轮询间隔与数据保留仅管理员可修改（修改密码和外观卡片
  所有人可用）；
- 页眉可退出登录；在设置页面可修改自己的密码
  （当前会话保持登录，其他会话将被退出）。

### 通过 GitLab 登录

除了本地密码（或与其并存），还可以通过局域网内的 GitLab 服务器以 OAuth2
（authorization code，scope `read_user`）认证 — 无需额外的 IdP 服务：

1. 在 GitLab 中创建 OAuth 应用（个人档案 → 「应用」，或在 Admin Area →
   「应用」中创建以供所有人使用），redirect URI 为
   `http://<monstrata-主机>:3003/api/auth/gitlab/callback`，scope 选
   `read_user`；
2. 把应用的 id/secret 写入 `config.json`：

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

- 登录页会出现「使用 GitLab 登录」按钮；
- 首次通过 GitLab 登录时创建同名本地用户并赋予管理员角色（仅在所有用户
  尚不存在时可能发生）；之后的 GitLab 登录创建普通 `user` 账户 — 由管理员
  在「用户」页面为其提权；新的 GitLab 用户带有「GitLab」徽标，没有密码，
  可在设置页面设置本地密码（此时表单只要求新密码，不要求当前密码），以便在
  GitLab 不可用时仍能登录；
- `allowedGroups`（可选）只允许这些 GitLab 组的成员登录；子组成员同样
  有效；留空则该 GitLab 的任何用户都可登录；
- `redirectUri`（可选）覆盖从请求推导的 callback 地址 — 仅在会改写主机名的
  reverse proxy 之后才需要。

忘记密码？在服务器上、项目根目录执行（无需邮箱，服务器无需停止）：

```sh
node scripts/reset-password.mjs --list
node scripts/reset-password.mjs <用户名或 id> [新密码]
```

重置会退出该用户的所有会话。

## 数据存储

| 层级 | 粒度 | 默认保留期 |
|---|---|---|
| `samples` | 每个轮询周期（约 10 秒） | 48 小时 |
| `rollup_hourly` | 小时桶（avg/max/min） | 400 天 |
| `rollup_daily` | 天桶 | 永久 |

采集时计数器（`*_total`）会被转换为速率（`derived:*`）：
`gen_tok_s`、`prompt_tok_s`、`req_s`、TTFT / ITL / E2E 的窗口平均值
`_sum/_count`，以及引擎和显存占用百分比。

## 项目结构

```
app/            Vue 3 + Nuxt UI 前端
  pages/        仪表盘、服务器详情、热力图、服务器列表、用户、设置、登录
  components/   ServerCard、MetricChart (uPlot)、LoadHeatmap 等
  plugins/live.ts  共享状态 + WebSocket 客户端
i18n/locales/   语言词典：en、ru、de、es、fr、zh
server/
  middleware/   auth.ts — /api 的会话关卡（由 config.json 开启）
  utils/        Prometheus 解析器、SQLite、指标目录、采集器、汇总、认证原语、
                权限规则、GitLab OAuth 辅助
  plugins/      后台循环（scrape、rollups）
  api/          servers CRUD、live、range、heatmap、settings、auth、users
  routes/_ws.ts WebSocket 端点
scripts/        reset-password.mjs — 密码恢复（无需邮箱）
test/           基于真实 /metrics 固定数据的解析器测试 + 认证测试
```

## API

- `GET|POST /api/servers`、`PATCH|DELETE /api/servers/:id`、`POST /api/servers/:id/ping`（PATCH/DELETE：开启验证后仅创建者或管理员可调用）
- `GET /api/live` — 所有服务器的当前快照
- `GET /api/range?serverId&metric&from&to` — 指标历史（raw/hourly/daily — 数据源自动选择）
- `GET /api/heatmap?metric&period=1h|3h|12h|24h|7d|30d|1y` — 服务器 × 时间桶矩阵
- `GET|PUT /api/settings`（`PUT`：开启验证后仅管理员）
- `/api/auth/status|setup|login|logout|password`、`/api/auth/gitlab/start|callback` — 身份验证（公开：status、setup、login、logout、gitlab/*）
- `GET /api/users`、`PATCH|DELETE /api/users/:id` — 用户管理（仅管理员；PATCH 接受 `role`、`disabled`、`password`）
- `WS /_ws` — 推送快照

## 测试

```sh
node test/parse.test.mjs
node test/auth.test.mjs
node test/config.test.mjs
```

## 备注

- 需要 Node ≥ 22.22 / 24.15（较旧的 Node 24 上 Nuxt 4.6 可能
  报 EBADENGINE 警告）。
- `nuxt.config.ts` 中有两个重要的环境绕行配置：
  - `nitro.externals.inline` — 仅在 Windows 上需要的临时方案，
    等待 [nuxt/nuxt#36467](https://github.com/nuxt/nuxt/issues/36467)
    修复（否则整个 SSR 返回 500）；
  - `nitro.experimental.websocket: true` — 在服务端预设中启用
    WebSocket 升级挂载（否则 `/_ws` 在开发和生产环境都无法工作）。
- 若没有 `Accept: text/plain` 请求头，Strata 的 `/metrics`
  会返回 JSON — 采集器始终发送该请求头。
- 身份验证默认关闭（本服务面向受信任的本地网络）；开启后，除认证引导接口外，
  所有 `/api` 和 `/_ws` 都需要有效的会话 cookie。
