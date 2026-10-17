import { authStatus } from '../../utils/auth'

// public endpoint — also reports whether auth is on and users exist
export default defineEventHandler((event) => authStatus(event))
