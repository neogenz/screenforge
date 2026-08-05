// End-to-end export probe: drives the real UI, downloads the ZIP,
// then validates it against App Store rules (scripts/validate-export.mjs).
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5199'
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
})
const page = await context.newPage()
await page.goto(baseURL)
// Browser global inside Playwright's page context.

await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
await page.waitForTimeout(1200)

// Realistic content: device frame + text + gradient background preset.
await page.click('button[aria-label="Ajouter un cadre iPhone"]')
await page.click('[role="menu"] [role="menuitem"] >> nth=0')
await page.waitForTimeout(500)
await page.click('button[aria-label="Ajouter Texte"]')
await page.waitForTimeout(800)
// v3: Escape closes the drawers first, then clears the selection.
await page.keyboard.press('Escape')
await page.keyboard.press('Escape')
await page.click('button[aria-label="Basculer le panneau Propriétés"]')
await page.waitForTimeout(300)
await page.click('button:has-text("Préréglages")')
await page.waitForTimeout(300)
await page.locator('[aria-label^="Appliquer le dégradé"]').first().click()
await page.waitForTimeout(800)

await page.click('button[aria-label="Ouvrir l’export"]')
await page.waitForTimeout(500)
const downloadPromise = page.waitForEvent('download', { timeout: 90000 })
await page.click('button:has-text("Exporter le ZIP")')
const download = await downloadPromise
const target = '/tmp/sf-export.zip'
await download.saveAs(target)
await browser.close()

console.log(`ZIP téléchargé → ${target}`)
execFileSync('node', ['scripts/validate-export.mjs', target], { stdio: 'inherit' })
