import { initUpdate } from '../utils/update'

// version check loop: learns the running commit at boot, then asks origin for
// the branch head every 6 h so the sidebar can flag "update available".
// Applying an update stays manual (POST /api/update/apply).
export default defineNitroPlugin(() => {
  void initUpdate()
})
