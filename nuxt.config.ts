export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  nitro: {
    // native module must not be bundled
    external: ['better-sqlite3']
  },
  ui: {
    // system fonts, no network fetch at build time
    fonts: false
  },
  devtools: { enabled: false },
  typescript: { strict: true },
  compatibilityDate: '2026-10-09'
})
