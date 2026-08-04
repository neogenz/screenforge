/**
 * Sonde visuelle : les quatre états qui se jugent à l'œil.
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

for (const theme of ['dark', 'light']) {
  for (const state of ['vide', 'peuple']) {
    // Contexte neuf à chaque capture : localStorage et IndexedDB repartent à zéro.
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()

    await page.goto(baseURL)
    // Browser globals inside Playwright's page context.
    await page.evaluate((theme) => localStorage.setItem('screenforge-theme', theme), theme)
    await page.evaluate(() => new Promise((resolve) => {
      // eslint-disable-next-line no-undef
      const request = indexedDB.deleteDatabase('screenforge')
      request.onsuccess = request.onerror = request.onblocked = () => resolve(undefined)
    }))
    await page.reload()
    // eslint-disable-next-line no-undef
    await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
    await page.waitForTimeout(1200)

    if (state === 'peuple') {
      await page.click('button[aria-label="Ajouter un cadre iPhone"]')
      await page.click('[role="menu"] [role="menuitem"] >> nth=0')
      await page.waitForTimeout(500)
      await page.click('button[aria-label="Ajouter Texte"]')
      await page.waitForTimeout(900)
    }

    const path = `${outputDir}/${theme}-${state}.png`
    await page.screenshot({ path })
    console.log(path)
    await context.close()
  }
}

await browser.close()
