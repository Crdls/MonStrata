export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  nitro: {
    // native module must not be bundled
    external: ['better-sqlite3'],
    experimental: {
      // enable WebSocket route wiring in the node server (/_ws)
      websocket: true
    },
    // workaround for nuxt#36467 (Windows): force-inline the Nuxt renderer,
    // otherwise Nitro externals matching fails on backslash paths -> SSR 500
    externals: {
      inline: [/[\\/]node_modules[\\/]nuxt[\\/]dist[\\/]/]
    }
  },
  ui: {
    // system fonts, no network fetch at build time
    fonts: false
  },
  devtools: { enabled: false },
  typescript: { strict: true },
  compatibilityDate: '2026-10-09'
})
