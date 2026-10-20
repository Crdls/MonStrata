import { useDb, type ServerRow } from '../../../utils/db'
import { metricsHeaders, metricsUrl } from '../../../utils/scrape'
import { parsePrometheus } from '../../../utils/parse'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const server = useDb().prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow | undefined
  if (!server) throw createError({ statusCode: 404, statusMessage: 'server not found' })

  const t0 = Date.now()
  try {
    const res = await fetch(metricsUrl(server.url), {
      signal: AbortSignal.timeout(5000),
      headers: metricsHeaders(server)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { samples } = parsePrometheus(await res.text())
    if (samples.length === 0) throw new Error('response contained no samples')
    return { ok: true, ms: Date.now() - t0, series: samples.length }
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) }
  }
})
