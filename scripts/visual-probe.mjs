// Light theme check: same context so localStorage persists.
import { chromium } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5199'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

await page.goto(baseURL)
await page.evaluate(() => localStorage.setItem('screenforge-theme', 'light'))
await page.reload()
await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
await page.waitForTimeout(1200)

await page.click('button[aria-label="Ajouter un cadre iPhone"]')
await page.click('[role="menu"] [role="menuitem"] >> nth=0')
await page.waitForTimeout(500)
await page.click('button[aria-label="Ajouter Texte"]')
await page.waitForTimeout(900)
await page.screenshot({ path: '/tmp/sf-final-light.png' })

await browser.close()
console.log('done')
