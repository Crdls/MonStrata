export default defineNuxtPlugin(() => {
  // per-browser theme colors (localStorage) go on top of the app.config.ts
  // defaults before hydration paints; the server always renders the defaults
  applyStoredTheme()
})
