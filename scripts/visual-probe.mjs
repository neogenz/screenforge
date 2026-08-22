/**
 * Sonde visuelle : les états qui se jugent à l'œil.
 *
 * Vide, peuplé, dialog Export ouvert, menu ouvert, planche sans écran —
 * sombre et clair, en densité 2. Chaque état repart d'un contexte neuf : sans
 * quoi la passe « vide » hérite du projet de la passe précédente et ne montre
 * plus rien de ce qu'elle est censée montrer.
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173'
const outputDir = process.env.OUT_DIR ?? '/tmp/screenforge-probe'
mkdirSync(outputDir, { recursive: true })

/**
 * Un cadre iPhone + un texte : le décor commun à peuplé, export, menu.
 * @param {import('@playwright/test').Page} page
 */
async function populate(page) {
  await page.click('button[aria-label="Ajouter un cadre iPhone"]')
  await page.click('[role="menu"] [role="menuitem"] >> nth=0')
  await page.waitForTimeout(500)
  await page.click('button[aria-label="Ajouter Texte"]')
  await page.waitForTimeout(900)
}

/**
 * @type {{ name: string; setup: (page: import('@playwright/test').Page) => Promise<void> }[]}
 */
const STATES = [
  { name: 'vide', setup: async () => {} },
  { name: 'peuple', setup: populate },
  {
    name: 'export',
    setup: async (page) => {
      await populate(page)
      await page.click('button[aria-label="Ouvrir l’export"]')
      await page.waitForSelector('[role="dialog"]')
      await page.waitForTimeout(500)
    },
  },
  {
    name: 'menu',
    setup: async (page) => {
      // Ouvert, sans sélectionner d'item : c'est le popup lui-même qu'on juge.
      await page.click('button[aria-label="Ajouter un cadre iPhone"]')
      await page.waitForSelector('[role="menu"]')
      await page.waitForTimeout(300)
    },
  },
  {
    name: 'planche-vide',
    setup: async (page) => {
      // `screens.length === 0` n'arrive jamais par l'UI (`removeScreen` le
      // refuse) — forcé via le store de debug, comme `empty-state.spec.ts`.
      await page.evaluate(() => {
        const store = window.__sfStores?.useProjectStore
        const project = store?.getState().project
        if (!project) throw new Error('Aucun projet à vider')
        store.setState({ project: { ...project, screens: [], activeScreenId: '' } })
      })
      await page.waitForSelector('[role="status"]')
      await page.waitForTimeout(300)
    },
  },
]

const browser = await chromium.launch()

for (const theme of ['dark', 'light']) {
  for (const { name, setup } of STATES) {
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
    await page.waitForTimeout(1200)

    await setup(page)

    const path = `${outputDir}/${theme}-${name}.png`
    await page.screenshot({ path })
    console.log(path)
    await context.close()
  }
}

await browser.close()
