import { requireAdmin } from '../../../utils/auth'
import { loadConfig } from '../../../utils/config'
import { listGatewayClients } from '../../../utils/db'
import { clientView } from '../../../utils/gateway/view'

const DAY = 86_400_000

// the client table for the admin UI (admin-only while auth is on)
export default defineEventHandler((event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  const today = Math.floor(Date.now() / DAY) * DAY
  return listGatewayClients(today).map(clientView)
})
