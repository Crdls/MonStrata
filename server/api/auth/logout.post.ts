import { endSession } from '../../utils/auth'
import { loadConfig } from '../../utils/config'

export default defineEventHandler((event) => {
  if (loadConfig().auth.enabled) endSession(event)
  return { ok: true }
})
