import { useDb } from '../utils/db'
import { metricDef } from '../utils/metrics'

const HOUR = 3_600_000
const DAY = 86_400_000

interface Point { t: number, labels: string, v: number }

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const serverId = Number(q.serverId)
  const metric = typeof q.metric === 'string' ? q.metric : ''
  if (!Number.isInteger(serverId) || !metric) {
    throw createError({ statusCode: 400, statusMessage: 'serverId and metric are required' })
  }
  const to = Math.min(Number(q.to) || Date.now(), Date.now() + 60_000)
  const from = Number(q.from) || to - HOUR
  if (!(from < to)) throw createError({ statusCode: 400, statusMessage: 'from must be before to' })
  const maxPoints = Math.min(Math.max(Number(q.maxPoints) || 600, 50), 2000)

  const db = useDb()
  const count = (sql: string, tsCol: string) =>
    (db.prepare(`SELECT COUNT(*) AS c FROM ${sql} WHERE server_id = ? AND metric = ? AND ${tsCol} BETWEEN ? AND ?`)
      .get(serverId, metric, from, to) as { c: number }).c

  const rawCount = count('samples', 'ts')
  const hourlyCount = count('rollup_hourly', 'hour')
  const dailyCount = count('rollup_daily', 'day')

  let source: 'raw' | 'hourly' | 'daily'
  if (rawCount > 0 && rawCount <= maxPoints * 4) source = 'raw'
  else if (hourlyCount > 0) source = 'hourly'
  else if (dailyCount > 0) source = 'daily'
  else source = 'raw'

  let step: number
  let sql: string
  const params: Record<string, number | string> = { sid: serverId, metric, from, to }
  if (source === 'raw') {
    step = Math.max(1, Math.ceil((to - from) / maxPoints / 1000)) * 1000
    params.step = step
    sql = `SELECT CAST(ts / @step AS INTEGER) * @step AS t, labels, AVG(value) AS v
           FROM samples
           WHERE server_id = @sid AND metric = @metric AND ts BETWEEN @from AND @to
           GROUP BY t, labels ORDER BY t`
  } else if (source === 'hourly') {
    step = Math.max(HOUR, Math.ceil((to - from) / maxPoints / HOUR) * HOUR)
    params.step = step
    sql = `SELECT CAST(hour / @step AS INTEGER) * @step AS t, labels, SUM(avg * n) / SUM(n) AS v
           FROM rollup_hourly
           WHERE server_id = @sid AND metric = @metric AND hour BETWEEN @from AND @to
           GROUP BY t, labels ORDER BY t`
  } else {
    step = Math.max(DAY, Math.ceil((to - from) / maxPoints / DAY) * DAY)
    params.step = step
    sql = `SELECT CAST(day / @step AS INTEGER) * @step AS t, labels, SUM(avg * n) / SUM(n) AS v
           FROM rollup_daily
           WHERE server_id = @sid AND metric = @metric AND day BETWEEN @from AND @to
           GROUP BY t, labels ORDER BY t`
  }

  const rows = db.prepare(sql).all(params) as Point[]
  const byLabels = new Map<string, Array<[number, number]>>()
  for (const r of rows) {
    ;(byLabels.get(r.labels) ?? byLabels.set(r.labels, []).get(r.labels)!).push([r.t, r.v])
  }
  return {
    serverId,
    metric,
    label: metricDef(metric).label,
    unit: metricDef(metric).unit,
    scale: metricDef(metric).scale ?? 1,
    from,
    to,
    step,
    source,
    series: [...byLabels.entries()].map(([labels, points]) => ({ labels, points }))
  }
})
