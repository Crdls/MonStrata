import { useDb, type ServerRow } from '../utils/db'
import { HEATMAP_METRICS, metricDef } from '../utils/metrics'

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const PERIODS: Record<string, { span: number, bucket: number, source: 'raw' | 'hourly' | 'daily' }> = {
  '1h': { span: HOUR, bucket: 2 * MIN, source: 'raw' },
  '3h': { span: 3 * HOUR, bucket: 10 * MIN, source: 'raw' },
  '12h': { span: 12 * HOUR, bucket: 30 * MIN, source: 'raw' },
  '24h': { span: 24 * HOUR, bucket: HOUR, source: 'raw' },
  '7d': { span: 7 * DAY, bucket: HOUR, source: 'hourly' },
  '30d': { span: 30 * DAY, bucket: 6 * HOUR, source: 'hourly' },
  '1y': { span: 365 * DAY, bucket: DAY, source: 'daily' }
}

const AGG_FN: Record<string, string> = { avg: 'AVG', sum: 'SUM', max: 'MAX' }

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const periodKey = typeof q.period === 'string' && PERIODS[q.period] ? q.period : '24h'
  const period = PERIODS[periodKey]!
  const metric = typeof q.metric === 'string' && q.metric ? q.metric : 'strata:gpu_util'
  const agg = AGG_FN[metricDef(metric).agg] ?? 'AVG'

  const db = useDb()
  const servers = db.prepare('SELECT * FROM servers ORDER BY name COLLATE NOCASE').all() as ServerRow[]
  const now = Date.now()
  const from = Math.floor((now - period.span) / period.bucket) * period.bucket

  const buckets: number[] = []
  for (let t = from; t <= now; t += period.bucket) buckets.push(t)

  const table = period.source === 'raw' ? 'samples' : period.source === 'hourly' ? 'rollup_hourly' : 'rollup_daily'
  const tsCol = period.source === 'raw' ? 'ts' : period.source === 'hourly' ? 'hour' : 'day'
  const valCol = period.source === 'raw' ? 'value' : 'avg'
  const sql = `
    SELECT t, ${agg}(s) AS v FROM (
      SELECT CAST(${tsCol} / @bucket AS INTEGER) * @bucket AS t, labels, AVG(${valCol}) AS s
      FROM ${table}
      WHERE server_id = @sid AND metric = @metric AND ${tsCol} >= @from
      GROUP BY t, labels
    )
    GROUP BY t`
  const stmt = db.prepare(sql)

  const rows = servers.map((server) => {
    const byBucket = new Map<number, number>(
      (stmt.all({ sid: server.id, metric, from, bucket: period.bucket }) as Array<{ t: number, v: number }>)
        .map(r => [r.t, r.v])
    )
    return {
      serverId: server.id,
      name: server.name,
      values: buckets.map(t => byBucket.get(t) ?? null)
    }
  })

  return {
    metric,
    metricLabel: metricDef(metric).label,
    unit: metricDef(metric).unit,
    scale: metricDef(metric).scale ?? 1,
    period: periodKey,
    bucketMs: period.bucket,
    buckets,
    rows,
    availableMetrics: HEATMAP_METRICS.map(k => ({
      value: k,
      label: metricDef(k).label,
      unit: metricDef(k).unit
    }))
  }
})
