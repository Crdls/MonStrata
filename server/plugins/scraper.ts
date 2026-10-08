import { useDb } from '../utils/db'
import { scrapeAll } from '../utils/scrape'
import { scheduleScrape } from '../utils/scheduler'

export default defineNitroPlugin(() => {
  useDb() // ensure schema exists
  scheduleScrape()
  void scrapeAll().catch(err => console.error('[stratamon] initial scrape failed:', err))
})
