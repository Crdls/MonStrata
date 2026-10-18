import { requireAdmin } from '../../utils/auth'
import { listUsers } from '../../utils/db'

// admin-only user table; the password hash is never part of the payload
export default defineEventHandler((event) => {
  requireAdmin(event)
  return listUsers()
})
