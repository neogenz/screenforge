import { expect, test } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Le chrome flottant face à une fenêtre qui rétrécit.
 *
 * Trois défauts mesurés avant ces seuils, tous silencieux : à 560px la barre
 * débordait de 118px et « Exporter » quittait l'écran ; à 375px elle en perdait
 * six contrôles et les deux tiroirs se recouvraient de 249px ; le HUD de zoom
 * mordait sur la pellicule. Les seuils viennent de `lib/stage.ts`, jamais d'une
 * copie — c'est la leçon de la constante de pellicule restée à 142.
 */
import {
  DUAL_DRAWER_MIN_WIDTH,
  MIN_APP_WIDTH,
  TOP_BAR_COMPACT_WIDTH,
} from '../src/lib/stage'

const HEIGHT = 900

test('garde Exporter à l’écran et un seul tiroir quand la fenêtre se resserre', async ({ page }) => {
  await waitForApp(page)

  // Large : la rangée complète, les deux tiroirs.
  await page.setViewportSize({ width: 1440, height: HEIGHT })
  await expect(page.getByLabel('Ouvrir les modèles')).toBeVisible()
  await expect(page.getByLabel('Ouvrir les autres actions')).toHaveCount(0)

  // Sous le seuil des deux tiroirs : il n'en reste qu'un, et c'est celui
  // qui édite.
  await page.setViewportSize({ width: DUAL_DRAWER_MIN_WIDTH - 40, height: HEIGHT })
  await expect.poll(async () => page.evaluate(() => ({
    layers: window.__sfStores?.useUIStore.getState().layersOpen,
    props: window.__sfStores?.useUIStore.getState().propsOpen,
  }))).toEqual({ layers: false, props: true })

  // Sous le seuil de la barre : les actions secondaires passent au menu, le
  // CTA principal reste sur la rangée et dans le viewport.
  await page.setViewportSize({ width: TOP_BAR_COMPACT_WIDTH - 40, height: HEIGHT })
  await expect(page.getByLabel('Ouvrir les autres actions')).toBeVisible()
  await expect(page.getByLabel('Ouvrir les modèles')).toHaveCount(0)

  const exportButton = page.getByLabel('Ouvrir l’export')
  await expect(exportButton).toBeVisible()
  const box = await exportButton.boundingBox()
  expect(box, 'le bouton Exporter n’a pas de boîte').not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual(TOP_BAR_COMPACT_WIDTH - 40)

  // Les actions repliées restent atteignables, pas seulement présentes.
  await page.getByLabel('Ouvrir les autres actions').click()
  await expect(page.getByRole('menuitem', { name: 'Changer de thème' })).toBeVisible()
})

test('annonce sa largeur minimale au lieu de rendre un éditeur déformé', async ({ page }) => {
  await waitForApp(page)

  await page.setViewportSize({ width: MIN_APP_WIDTH - 40, height: HEIGHT })
  await expect(page.getByRole('heading', { name: 'Fenêtre trop étroite' })).toBeVisible()
  // La contrainte est chiffrée : « trop étroite » sans le nombre ne dit pas
  // jusqu'où élargir.
  await expect(page.getByText(String(MIN_APP_WIDTH), { exact: false })).toBeVisible()
  await expect(page.getByLabel('Ouvrir l’export')).toHaveCount(0)

  // Élargir rend l'éditeur, sans rechargement.
  await page.setViewportSize({ width: 1280, height: HEIGHT })
  await expect(page.getByLabel('Ouvrir l’export')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fenêtre trop étroite' })).toHaveCount(0)
})
