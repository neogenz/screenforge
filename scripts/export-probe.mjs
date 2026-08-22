// End-to-end export probe: drives the real UI, downloads the ZIP,
// then validates it against the selected store profile.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5199'
const targetAt = process.argv.indexOf('--target')
const requestedTarget = targetAt >= 0 ? process.argv[targetAt + 1] : 'app-store-iphone'
if (requestedTarget !== 'app-store-iphone' && requestedTarget !== 'google-play-phone') {
  throw new Error(`Cible inconnue : ${requestedTarget}`)
}
const target = /** @type {import('../packages/project-format/src/types.ts').StoreTargetId} */ (
  requestedTarget
)
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
})
const page = await context.newPage()
await page.goto(baseURL)
// Browser global inside Playwright's page context.

await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
await page.evaluate((storeTarget) => {
  window.__sfStores?.useProjectStore.getState().createProject('Export probe', storeTarget)
}, target)
await page.waitForFunction(
  (storeTarget) => window.__sfStores?.useProjectStore.getState().project?.target === storeTarget,
  target,
)
await page.waitForTimeout(1200)

// Realistic content: device frame + text + gradient background preset.
await page.click('button[aria-label="Ajouter un cadre de téléphone"]')
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
const output = `/tmp/sf-export-${target}.zip`
await download.saveAs(output)
await browser.close()

console.log(`ZIP téléchargé → ${output}`)
execFileSync('node', ['scripts/validate-export.mjs', output, '--target', target], {
  stdio: 'inherit',
})
