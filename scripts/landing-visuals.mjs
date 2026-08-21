/**
 * Visuels de la landing : des captures réelles du produit, jamais des mockups.
 *
 * Peuple un projet dans l'app (cadre de téléphone + titre + dégradés), décline la
 * planche sur quatre écrans, puis capture trois états : la scène (hero),
 * l'éditeur avec le panneau Calques (feature) et la preuve des deux ZIP. Une
 * quatrième capture 1200×630 sert d'image Open Graph.
 *
 * Prérequis : le serveur de dev sur :5199 (`npm run dev -- --port 5199`).
 * Sortie : apps/web/public/landing/*.png et apps/web/public/og-landing.png.
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5199'
mkdirSync('apps/web/public/landing', { recursive: true })

const GRADIENTS = [
  {
    angle: 135,
    stops: [
      { offset: 0, color: '#ff7c29' },
      { offset: 0.5, color: '#ff3c8e' },
      { offset: 1, color: '#9b1dff' },
    ],
  },
  {
    angle: 180,
    stops: [
      { offset: 0, color: '#0a2463' },
      { offset: 1, color: '#3e8989' },
    ],
  },
  {
    angle: 135,
    stops: [
      { offset: 0, color: '#11998e' },
      { offset: 1, color: '#38ef7d' },
    ],
  },
  {
    angle: 160,
    stops: [
      { offset: 0, color: '#232526' },
      { offset: 1, color: '#414345' },
    ],
  },
]

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()

await page.goto(baseURL)
await page.evaluate(() => localStorage.setItem('screenforge-theme', 'dark'))
await page.evaluate(
  () =>
    new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('screenforge')
      request.onsuccess = request.onerror = request.onblocked = () => resolve(undefined)
    }),
)
await page.reload()
await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
await page.waitForTimeout(1200)

// Un écran soigné : cadre de téléphone + titre, sur un dégradé.
await page.click('button[aria-label="Ajouter un cadre de téléphone"]')
await page.click('[role="menu"] [role="menuitem"] >> nth=0')
await page.waitForTimeout(600)
await page.click('button[aria-label="Ajouter Texte"]')
await page.waitForTimeout(900)

const screenIds = await page.evaluate((gradients) => {
  // La déclaration globale de `__sfStores` (e2e/helpers.ts) n'expose que ce
  // que les specs lisent ; la sonde a besoin du store projet complet.
  const stores = /** @type {any} */ (window.__sfStores)
  if (!stores) throw new Error('__sfStores absent — le script exige le serveur de dev')
  const { useProjectStore } = stores
  const first = useProjectStore.getState().project.screens[0]
  useProjectStore.getState().updateScreenBackground(first.id, {
    type: 'linear-gradient',
    ...gradients[0],
  })
  const ids = [first.id]
  for (let i = 1; i < gradients.length; i++) {
    const id = useProjectStore.getState().duplicateScreen(ids[0])
    if (id) ids.push(id)
  }
  ids.forEach((id, i) => {
    useProjectStore.getState().updateScreenBackground(id, {
      type: 'linear-gradient',
      ...gradients[i],
    })
  })
  return ids
}, GRADIENTS)
console.log('écrans:', screenIds.length)
await page.waitForTimeout(1500)

// Hero : la scène avec la planche de quatre écrans.
const canvasBox = await page.locator('canvas').first().boundingBox()
await page.screenshot({
  path: 'apps/web/public/landing/hero.png',
  clip: canvasBox ?? undefined,
})
console.log('apps/web/public/landing/hero.png')

// Feature éditeur : le panneau Calques ouvert sur la planche.
await page.keyboard.press('Meta+Shift+L')
await page.waitForTimeout(600)
await page.screenshot({ path: 'apps/web/public/landing/editor.png' })
console.log('apps/web/public/landing/editor.png')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// Feature export : la spécification rendue montre les deux profils réels.
await page.goto(`${baseURL}/landing.html`)
await page.getByRole('tab', { name: 'Export' }).click()
const exportSpec = page.locator('figure[aria-label="What lands in your Downloads folder"]')
await exportSpec.waitFor()
await exportSpec.screenshot({ path: 'apps/web/public/landing/export.png' })
console.log('apps/web/public/landing/export.png')

// Open Graph : un cadrage 1200×630 dédié, densité 1.
const ogContext = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
})
const ogPage = await ogContext.newPage()
await ogPage.goto(baseURL)
await ogPage.evaluate(() => localStorage.setItem('screenforge-theme', 'dark'))
await ogPage.reload()
await ogPage.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20000 })
await ogPage.waitForTimeout(1500)
await ogPage.screenshot({ path: 'apps/web/public/og-landing.png' })
console.log('apps/web/public/og-landing.png')

await browser.close()
