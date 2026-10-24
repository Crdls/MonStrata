import { checkForUpdate, updateStatusPayload } from '../../utils/update'

// manual re-check; the auth middleware already requires a session while auth is on
export default defineEventHandler(async () => {
  await checkForUpdate()
  return updateStatusPayload()
})
