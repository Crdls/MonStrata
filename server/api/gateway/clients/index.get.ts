import { requireAdmin } from '../../../utils/auth'
import { loadConfig } from '../../../utils/config'
import { listGatewayClients, useDb } from '../../../utils/db'
import { clientView } from '../../../utils/gateway/view'

const DAY = 86_400_000

// the client table for the admin UI (admin-only while auth is on)
export default defineEventHandler((event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const today = Math.floor(Date.now() / DAY) * DAY
  const byClient = new Map<number, number[]>()
  const pairs = useDb().prepare('SELECT client_id, server_id FROM gateway_client_servers').all() as Array<{ client_id: number, server_id: number }>
  for (const p of pairs) {
    const list = byClient.get(p.client_id)
    if (list) list.push(p.server_id)
    else byClient.set(p.client_id, [p.server_id])
  }
  return listGatewayClients(today).map(c => clientView(c, c.servers_all === 1 ? [] : byClient.get(c.id) ?? []))
})
