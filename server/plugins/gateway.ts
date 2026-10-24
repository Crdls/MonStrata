import { startGatewayLoop } from '../utils/gateway/state'

// the gateway's 5 s maintenance loop: queue dispatch, stats flushes,
// affinity expiry — runs whether or not the gateway is enabled (flushes)
export default defineNitroPlugin(() => {
  startGatewayLoop()
})
