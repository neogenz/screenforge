// Measure shared (layout) layer instances across two artboards.
import { chromium } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://localhost:8080'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto(baseURL)
await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
await page.waitForTimeout(1200)

// Fresh project state: clear any stored project first.
await page.evaluate(() => indexedDB.deleteDatabase('screenforge'))
await page.reload()
await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
await page.waitForTimeout(1200)

// Screen 2
await page.click('button[aria-label="Ajouter un écran"]')
await page.waitForTimeout(600)

// Back to screen 1, add a device layer
await page.locator('button[aria-label^="Activer"]').first().click()
await page.waitForTimeout(600)
await page.click('button[aria-label="Ajouter un cadre iPhone"]')
await page.click('[role="menu"] [role="menuitem"] >> nth=0')
await page.waitForTimeout(800)

// Share it across screens
await page.click('button:has-text("Partager partout")')
await page.waitForTimeout(1000)

// Rotate 12° and move it to span the boundary (Position X via panel)
await page.getByLabel('Rotation').fill('12')
await page.getByLabel('Rotation').press('Enter')
await page.waitForTimeout(600)
await page.getByLabel('Position X').fill('280')
await page.getByLabel('Position X').press('Enter')
await page.waitForTimeout(1000)

const report = await page.evaluate(() => {
  const canvas = window.__sfCanvas
  const stores = window.__sfStores
  if (!canvas || !stores) throw new Error('ScreenForge debug handles unavailable')
  /** @type {Array<import('../e2e/helpers').DebugObject & { clipPath?: { left?: number; top?: number } }>} */
  const rendered = /** @type {never} */ (canvas.getObjects())
  const objects = rendered
    .filter((o) => o.data?.rendererType === 'device-frame')
    .map((o) => ({
      uid: o.data?.uid,
      layout: o.data?.layout,
      screenIndex: o.data?.screenIndex,
      clipScreenIndex: o.data?.clipScreenIndex,
      left: Math.round((o.left ?? 0) * 100) / 100,
      top: Math.round((o.top ?? 0) * 100) / 100,
      angle: Math.round((o.angle ?? 0) * 100) / 100,
      clipLeft: o.clipPath?.left,
      clipTop: o.clipPath?.top,
    }))
  const project = stores.useProjectStore.getState().project
  const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
  const layers = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].map((l) => ({
    id: l.id, type: l.type, scope: l.scope, x: l.x, y: l.y, rotation: l.rotation,
  }))
  return { objects, layers, viewport: canvas.viewportTransform }
})
console.log(JSON.stringify(report, null, 2))

// Screenshot the junction for visual confirmation
await page.screenshot({ path: '/tmp/sf-measure.png' })
await browser.close()
