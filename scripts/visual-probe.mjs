/**
 * Sonde visuelle : les états Apple et Android qui se jugent à l'œil.
 *
 * Vide et peuplé, sombre et clair, en densité 2. Chaque état repart d'un
 * contexte neuf : sans quoi la passe « vide » hérite du projet de la passe
 * précédente et ne montre plus rien de ce qu'elle est censée montrer.
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173'
const outputDir = process.env.OUT_DIR ?? '/tmp/screenforge-probe'
mkdirSync(outputDir, { recursive: true })

const browser = await chromium.launch()
const states = [
  { id: 'vide', target: 'app-store-iphone', populated: false },
  { id: 'peuple', target: 'app-store-iphone', populated: true },
  { id: 'android-vide', target: 'google-play-phone', populated: false },
  { id: 'android-peuple', target: 'google-play-phone', populated: true },
]

for (const theme of ['dark', 'light']) {
  for (const state of states) {
    // Contexte neuf à chaque capture : localStorage et IndexedDB repartent à zéro.
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()

    await page.goto(baseURL)
    // Browser globals inside Playwright's page context.
    await page.evaluate((theme) => localStorage.setItem('screenforge-theme', theme), theme)
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.deleteDatabase('screenforge')
          request.onsuccess = request.onerror = request.onblocked = () => resolve(undefined)
        }),
    )
    await page.reload()
    await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
    await page.waitForFunction(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const objects = /** @type {Array<{data?: {rendererType?: string, screenId?: string}}>} */ (
        window.__sfCanvas?.getObjects() ?? []
      )
      return Boolean(
        project &&
        objects.some(
          (object) =>
            object.data?.rendererType === 'background' &&
            object.data?.screenId === project.activeScreenId,
        ),
      )
    })

    if (state.target === 'google-play-phone') {
      await page.evaluate(() =>
        window.__sfStores?.useProjectStore
          .getState()
          .createProject('Sonde Android', 'google-play-phone'),
      )
      await page.waitForFunction(() => {
        const objects = /** @type {Array<{data?: {rendererType?: string}, width?: number}>} */ (
          window.__sfCanvas?.getObjects() ?? []
        )
        return (
          window.__sfStores?.useProjectStore.getState().project?.target === 'google-play-phone' &&
          objects.some(
            (object) => object.data?.rendererType === 'background' && object.width === 540,
          )
        )
      })
    }

    if (state.populated) {
      await page.click('button[aria-label="Ajouter un cadre de téléphone"]')
      await page.click('[role="menu"] [role="menuitem"] >> nth=0')
      await page.waitForTimeout(500)
      await page.click('button[aria-label="Ajouter Texte"]')
      await page.waitForFunction(() => {
        const objects = /** @type {Array<{data?: {layerId?: string}}>} */ (
          window.__sfCanvas?.getObjects() ?? []
        )
        return objects.filter((object) => object.data?.layerId).length === 2
      })
    }

    const path = `${outputDir}/${theme}-${state.id}.png`
    await page.screenshot({ path })
    console.log(path)
    await context.close()
  }
}

await browser.close()
