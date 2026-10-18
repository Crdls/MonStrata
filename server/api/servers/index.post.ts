import { useDb, type ServerRow } from '../../utils/db'
import { broadcast, scrapeServer, validateBaseUrl } from '../../utils/scrape'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string, url?: string }>(event)
  const name = body?.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name is required' })
  let url: string
  try {
    url = validateBaseUrl(body?.url ?? '')
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'invalid url' })
  }
  const db = useDb()
  if (db.prepare('SELECT 1 FROM servers WHERE url = ?').get(url)) {
    throw createError({ statusCode: 409, statusMessage: 'a server with this URL already exists' })
  }
  const info = db
    .prepare('INSERT INTO servers (name, url, enabled, created_at, created_by) VALUES (?, ?, 1, ?, ?)')
    .run(name, url, Date.now(), event.context.userId ?? null)
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(Number(info.lastInsertRowid)) as ServerRow
  // first scrape right away so the card appears without waiting for the cycle
  scrapeServer(server)
    .then(snapshot => broadcast({ type: 'snapshot', snapshot }))
    .catch(() => {})
  return { ...server, enabled: true }
})
