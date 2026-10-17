// Theme color picker data (Settings -> Appearance).
// Palette names must be Tailwind default palettes — the Nuxt UI runtime
// colors plugin resolves them against tailwindcss/colors. Classes must be
// literal strings so the Tailwind v4 scanner keeps the utilities.

export interface ThemeSwatch {
  value: string
  class: string
}

export const primarySwatches: ThemeSwatch[] = [
  { value: 'green', class: 'bg-green-500' },
  { value: 'emerald', class: 'bg-emerald-500' },
  { value: 'teal', class: 'bg-teal-500' },
  { value: 'blue', class: 'bg-blue-500' },
  { value: 'violet', class: 'bg-violet-500' },
  { value: 'fuchsia', class: 'bg-fuchsia-500' },
  { value: 'rose', class: 'bg-rose-500' },
  { value: 'orange', class: 'bg-orange-500' },
  { value: 'amber', class: 'bg-amber-500' }
]

// a light->dark gradient makes the near-identical grays distinguishable
export const neutralSwatches: ThemeSwatch[] = [
  { value: 'slate', class: 'bg-linear-to-br from-slate-300 to-slate-600' },
  { value: 'gray', class: 'bg-linear-to-br from-gray-300 to-gray-600' },
  { value: 'zinc', class: 'bg-linear-to-br from-zinc-300 to-zinc-600' },
  { value: 'neutral', class: 'bg-linear-to-br from-neutral-300 to-neutral-600' },
  { value: 'stone', class: 'bg-linear-to-br from-stone-300 to-stone-600' }
]

const THEME_KEY = 'monstrata_theme'

// apply the stored choice on top of the app.config.ts defaults (client only)
export function applyStoredTheme () {
  if (!import.meta.client) return
  const saved = readTheme()
  if (!saved) return
  const appConfig = useAppConfig()
  if (primarySwatches.some(s => s.value === saved.primary)) appConfig.ui.colors.primary = saved.primary
  if (neutralSwatches.some(s => s.value === saved.neutral)) appConfig.ui.colors.neutral = saved.neutral
}

export function storeTheme () {
  if (!import.meta.client) return
  const { primary, neutral } = useAppConfig().ui.colors
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify({ primary, neutral }))
  } catch {
    // private mode / quota — the choice just does not survive a reload
  }
}

function readTheme (): { primary?: string, neutral?: string } | null {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw ? JSON.parse(raw) as { primary?: string, neutral?: string } : null
  } catch {
    return null
  }
}
