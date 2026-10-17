export default defineAppConfig({
  ui: {
    colors: {
      // defaults matching the Nuxt UI v4 built-ins; users can override
      // primary/neutral in Settings (app/plugins/theme-color.ts applies
      // the per-browser choice from localStorage)
      primary: 'green',
      neutral: 'slate'
    }
  }
})
