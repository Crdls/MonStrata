import { cookieValue, verifySessionToken, SESSION_COOKIE } from '../utils/auth'
import { loadConfig } from '../utils/config'
import { runtime } from '../utils/runtime'

// ws://<host>/_ws - server pushes snapshots, client is read-only.
// WS upgrades bypass server middleware, so the session cookie is checked here.
export default defineWebSocketHandler({
  open (peer) {
    if (loadConfig().auth.enabled) {
      const cookie = peer.request?.headers?.get('cookie') ?? null
      if (!verifySessionToken(cookieValue(cookie, SESSION_COOKIE))) {
        peer.close(4401, 'unauthorized')
        return
      }
    }
    for (const snapshot of runtime().snapshots.values()) {
      peer.send({ type: 'snapshot', snapshot })
    }
  }
})
