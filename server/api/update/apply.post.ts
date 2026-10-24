import { requireAdmin } from '../../utils/auth'
import { loadConfig } from '../../utils/config'
import { applyUpdate } from '../../utils/update'

// kicks off scripts/autoupdate.mjs and exits with it; admin-only while auth
// is on (auth off = trusted LAN as everywhere else). Never runs by itself.
export default defineEventHandler(async (event) => {
  if (loadConfig().auth.enabled) requireAdmin(event)
  await applyUpdate()
  return { ok: true }
})
