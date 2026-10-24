import { requireAdmin } from '../../utils/auth'
import { loadConfig } from '../../utils/config'
import { gatewayStatus } from '../../utils/gateway/state'

// live gateway picture: queue lanes + per-server routing load (admin while auth is on)
export default defineEventHandler((event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  return gatewayStatus()
})
