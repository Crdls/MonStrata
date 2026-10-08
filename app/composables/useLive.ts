import type { LiveApi } from '../plugins/live'

export function useLive (): LiveApi {
  return useNuxtApp().$live as LiveApi
}
