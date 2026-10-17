export interface AuthUser {
  id: number
  username: string
}

export interface AuthStatus {
  authEnabled: boolean
  hasUsers: boolean
  user: AuthUser | null
}

export function useAuth () {
  // cached per page load by the global route middleware (transferred via SSR payload)
  const status = useState<AuthStatus | null>('authStatus', () => null)

  async function load (force = false): Promise<AuthStatus | null> {
    if (status.value && !force) return status.value
    // useRequestFetch so SSR forwards the incoming cookies to /api
    const requestFetch = useRequestFetch()
    try {
      status.value = await requestFetch<AuthStatus>('/api/auth/status')
    } catch {
      status.value = null // server unreachable — let pages render and fail naturally
    }
    return status.value
  }

  async function signOut () {
    if (import.meta.server) return
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* already signed out */ }
    // full reload so the live plugin drops its WebSocket
    location.assign('/login')
  }

  return { status, load, signOut }
}
