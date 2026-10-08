import { runtime } from '../utils/runtime'

// ws://<host>/_ws - server pushes snapshots, client is read-only
export default defineWebSocketHandler({
  open (peer) {
    for (const snapshot of runtime().snapshots.values()) {
      peer.send({ type: 'snapshot', snapshot })
    }
  }
})
