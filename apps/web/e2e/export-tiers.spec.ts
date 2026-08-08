/**
 * Ce que chaque palier change au fichier livré.
 *
 * Le chemin d'export est le chemin critique du produit : un filigrane mal posé
 * ne casse rien de visible en développement, il produit un PNG que App Store
 * Connect refuse, ou un PNG propre chez quelqu'un qui n'a pas payé. Les deux
 * fautes sont silencieuses, d'où ce fichier.
 *
 * Les droits sont posés dans le store plutôt que gagnés par un achat : le
 * chemin réel passe par Polar, un webhook et le miroir en base, et rien de tout
 * cela n'est joignable depuis une suite qui doit tourner sans Docker ni compte
 * marchand. Ce qui est mesuré ici est ce qui vient après.
 */
import { expect, test, type Page } from '@playwright/test'
import { decode } from 'fast-png'
import JSZip from 'jszip'
import { addDeviceLayer, grantEntitlements, readDownload, waitForApp } from './helpers'

/* Le filigrane est peint à 26 px du bas de la scène (956 de haut), et
   l'exportateur multiplie par 3 pour atteindre 2868. Les deux bandes sont lues
   dans le PNG final, pas dans la scène : c'est le fichier livré qui compte. */
const SCALE = 1320 / 440
const WATERMARK_ROW = Math.round((956 - 26) * SCALE)
const NEUTRAL_ROW = Math.round(956 * 0.1 * SCALE)

function row(png: ReturnType<typeof decode>, y: number): Uint8Array {
  const start = y * png.width * png.channels
  return Uint8Array.from(png.data.slice(start, start + png.width * png.channels))
}

/** Un export du palier gratuit : les PNG descendent un par un, sans ZIP. */
async function exportFreePng(page: Page) {
  await page.getByLabel('Ouvrir l’export').click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: 'Exporter les PNG' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^\d{2}_[a-z0-9_]+\.png$/)
  const png = decode(await readDownload(download))
  await page.getByRole('button', { name: 'Annuler' }).click()
  return png
}

function remainingNotice(page: Page) {
  return page.getByLabel('Profil d’export').getByText(/^\d sur 3$/)
}

test.describe('paliers à l’export', () => {
  /* Trois rendus complets dans un seul test : le plafond de 45 s de la
     configuration est trop court pour ce fichier. */
  test.setTimeout(120_000)

  test('sans compte, aucun appel réseau ne cherche les droits', async ({ page }) => {
    /* Critère 1 : le mode anonyme *est* le palier gratuit, il n'a rien à
       demander. `refreshEntitlements` sort avant la moindre requête quand la
       session est absente ; sans ce garde, chaque visiteur paierait un
       aller-retour pour s'entendre répondre « rien », et une instance
       injoignable ferait attendre l'éditeur au démarrage. */
    /* Les `fetch`/`xhr` seulement : en développement, Vite sert le module
       `src/lib/entitlements.ts` lui-même par HTTP, et c'est un `script`. Le
       compter reviendrait à interdire au fichier d'exister. */
    const requests: string[] = []
    page.on('request', (request) => {
      const type = request.resourceType()
      if (type === 'fetch' || type === 'xhr') requests.push(request.url())
    })

    await waitForApp(page)
    await page.getByLabel('Ouvrir l’export').click()
    await expect(remainingNotice(page)).toHaveText('3 sur 3')

    expect(requests.filter((url) => /entitlements|\/me(\?|$)/.test(url))).toEqual([])
  })

  test('le palier gratuit filigrane le PNG sans toucher à ses dimensions', async ({ page }) => {
    await waitForApp(page)
    await addDeviceLayer(page)
    await grantEntitlements(page, { licence: false })

    const gratuit = await exportFreePng(page)
    /* Critère 3 : le filigrane est peint dans la scène, donc le `multiplier`
       l'agrandit avec le reste et la cible reste au pixel près. */
    expect(gratuit.width).toBe(1320)
    expect(gratuit.height).toBe(2868)
    expect(gratuit.depth).toBe(8)
    expect(gratuit.channels).toBe(3)

    await grantEntitlements(page, { licence: true })
    await page.getByLabel('Ouvrir l’export').click()
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: 'Exporter le ZIP' }).click(),
    ])
    const zip = await JSZip.loadAsync(await readDownload(download))
    const entry = Object.values(zip.files).find((file) => !file.dir)
    const licencié = decode(await entry!.async('uint8array'))

    /* La preuve tient en deux lignes du même fichier : celle du filigrane
       diffère entre les deux paliers, celle du haut de l'image est identique.
       Sans la seconde, un rendu globalement différent passerait pour un
       filigrane. */
    expect(row(gratuit, WATERMARK_ROW)).not.toEqual(row(licencié, WATERMARK_ROW))
    expect(row(gratuit, NEUTRAL_ROW)).toEqual(row(licencié, NEUTRAL_ROW))
  })

  test('le quatrième export d’un projet est refusé et propose la Licence', async ({ page }) => {
    await waitForApp(page)
    await grantEntitlements(page, { licence: false })

    await page.getByLabel('Ouvrir l’export').click()
    await expect(remainingNotice(page)).toHaveText('3 sur 3')
    await page.getByRole('button', { name: 'Annuler' }).click()

    for (const attendu of ['2 sur 3', '1 sur 3', '0 sur 3']) {
      await exportFreePng(page)
      await page.getByLabel('Ouvrir l’export').click()
      await expect(remainingNotice(page)).toHaveText(attendu)
      await page.getByRole('button', { name: 'Annuler' }).click()
    }

    /* Critère 2 : le refus a une réponse. Un bouton grisé laisserait la boîte
       sans issue. */
    await page.getByLabel('Ouvrir l’export').click()
    await expect(page.getByRole('button', { name: 'Exporter les PNG' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Débloquer avec la Licence' }).click()
    await expect(page.getByRole('dialog', { name: 'Offres ScreenForge' })).toBeVisible()
  })

  test('un export en échec ne consomme pas de crédit', async ({ page }) => {
    await waitForApp(page)
    await grantEntitlements(page, { licence: false })

    /* La panne est posée sur le seul appel qui produit le fichier : tout le
       reste du chemin — polices, rendu, encodage — s'exécute pour de vrai, donc
       le crédit serait bien consommé si l'incrément n'était pas conditionné au
       succès du lot. */
    await page.evaluate(() => {
      const canvas = HTMLCanvasElement.prototype as unknown as {
        toBlob: (callback: (blob: Blob | null) => void) => void
        __sfRealToBlob?: unknown
      }
      canvas.__sfRealToBlob = canvas.toBlob
      canvas.toBlob = function (callback) {
        callback(null)
      }
    })

    await page.getByLabel('Ouvrir l’export').click()
    await page.getByRole('button', { name: 'Exporter les PNG' }).click()
    await expect(page.getByRole('alert')).toContainText('PNG vide')
    await expect(remainingNotice(page)).toHaveText('3 sur 3')
  })

  test('la Licence retire le filigrane, rend le ZIP et ne compte pas', async ({ page }) => {
    await waitForApp(page)
    await grantEntitlements(page, { licence: true })

    await page.getByLabel('Ouvrir l’export').click()
    /* Critère 5 : ni compteur, ni mention de filigrane — la carte du palier
       gratuit ne s'affiche pas du tout. */
    await expect(remainingNotice(page)).toHaveCount(0)
    await expect(page.getByText('Filigrane « Fait avec ScreenForge »')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Exporter le ZIP' })).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: 'Exporter le ZIP' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
    await page.getByRole('button', { name: 'Annuler' }).click()

    /* Aucune limite de nombre : l'export sous Licence n'a rien décompté, donc
       le palier gratuit retrouvé est encore entier. */
    await grantEntitlements(page, { licence: false })
    await page.getByLabel('Ouvrir l’export').click()
    await expect(remainingNotice(page)).toHaveText('3 sur 3')
  })
})
