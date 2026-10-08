import { getSettings, useDb } from './db'

const HOUR = 3_600_000
const DAY = 86_400_000

/**
 * Idempotent downsampling + retention. Safe to run at any frequency:
 * recent hours are recomputed from raw samples, recent days from hours.
 */
export function runRollups () {
  const db = useDb()
  const settings = getSettings()
  const now = Date.now()

  const fromHour = Math.floor((now - 3 * HOUR) / HOUR) * HOUR
  db.prepare(`
    INSERT INTO rollup_hourly (server_id, hour, metric, labels, avg, max, min, n)
    SELECT server_id, CAST(ts / @hour AS INTEGER) * @hour AS hour, metric, labels,
           AVG(value), MAX(value), MIN(value), COUNT(*)
    FROM samples
    WHERE ts >= @fromHour
    GROUP BY server_id, hour, metric, labels
    ON CONFLICT(server_id, hour, metric, labels) DO UPDATE SET
      avg = excluded.avg, max = excluded.max, min = excluded.min, n = excluded.n
  `).run({ hour: HOUR, fromHour })

  const fromDay = Math.floor((now - 3 * DAY) / DAY) * DAY
  db.prepare(`
    INSERT INTO rollup_daily (server_id, day, metric, labels, avg, max, min, n)
    SELECT server_id, CAST(hour / @day AS INTEGER) * @day AS day, metric, labels,
           SUM(avg * n) / SUM(n), MAX(max), MIN(min), SUM(n)
    FROM rollup_hourly
    WHERE hour >= @fromDay
    GROUP BY server_id, day, metric, labels
    ON CONFLICT(server_id, day, metric, labels) DO UPDATE SET
      avg = excluded.avg, max = excluded.max, min = excluded.min, n = excluded.n
  `).run({ day: DAY, fromDay })

  db.prepare('DELETE FROM samples WHERE ts < ?').run(now - settings.rawRetentionH * HOUR)
  db.prepare('DELETE FROM rollup_hourly WHERE hour < ?').run(now - settings.hourlyRetentionD * DAY)
  db.prepare('DELETE FROM server_status WHERE ts < ?').run(now - settings.hourlyRetentionD * DAY)
}
