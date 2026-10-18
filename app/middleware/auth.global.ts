import { useAuth } from '../composables/useAuth'

// auth is opt-in (config.json): with auth disabled this passes everything through
export default defineNuxtRouteMiddleware(async (to) => {
  const { load } = useAuth()
  const status = await load()
  if (!status || !status.authEnabled) {
    if (to.path === '/login' || to.path === '/users') return navigateTo('/')
    return undefined
  }
  if (status.user) {
    if (to.path === '/login') return navigateTo('/')
    // the user table is admin-only (the API enforces it too)
    if (to.path === '/users' && status.user.role !== 'admin') return navigateTo('/')
    return undefined
  }
  if (to.path !== '/login') return navigateTo('/login')
})
