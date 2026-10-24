import { updateUserLang } from '../../utils/db'

const LOCALES = ['en', 'ru', 'de', 'es', 'fr', 'zh']

// change own UI language; null resets to browser detection.
// 401 while auth is off (no session) - the Settings page then only switches
// the locale cookie, which is the pre-login behavior anyway
export default defineEventHandler(async (event) => {
  const userId = event.context.userId as number | undefined
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readBody<{ lang?: string | null }>(event)
  const lang = body?.lang
  if (lang !== null && (typeof lang !== 'string' || !LOCALES.includes(lang))) {
    throw createError({ statusCode: 400, statusMessage: 'lang must be a known locale or null' })
  }
  updateUserLang(userId, lang)
  return { ok: true }
})
