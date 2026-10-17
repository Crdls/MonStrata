import { useAuth } from '../composables/useAuth'

// auth is opt-in (config.json): with auth disabled this passes everything through
export default defineNuxtRouteMiddleware(async (to) => {
  const { load } = useAuth()
  const status = await load()
  if (!status || !status.authEnabled) {
    return to.path === '/login' ? navigateTo('/') : undefined
  }
  if (status.user) {
    return to.path === '/login' ? navigateTo('/') : undefined
  }
  if (to.path !== '/login') return navigateTo('/login')
})
