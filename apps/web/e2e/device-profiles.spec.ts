import { test, expect, type Page } from '@playwright/test'
import { decode } from 'fast-png'
import { downloadFirstExportedPng, waitForApp } from './helpers'
import { makeSolidPng } from './device-bezel-fixture'
import type { Project } from '../src/types'

async function createTargetProject(
  page: Page,
  name: string,
  optionName: RegExp,
  profileId: Project['profileId'],
): Promise<void> {
  await page.getByLabel('Ouvrir le sélecteur de projets').click()
  await page.getByRole('button', { name: 'Nouveau projet…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nom du nouveau projet').fill(name)
  await dialog.getByLabel('Format App Store').click()
  await page.getByRole('option', { name: optionName }).click()
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(dialog).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(() => window.__sfStores?.useProjectStore.getState().project?.profileId),
    )
    .toBe(profileId)
}

async function activeDeviceState(page: Page) {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    return (screen?.layers ?? [])
      .filter((layer) => layer.type === 'device-frame')
      .map((layer) => ({
        model: layer.deviceModel,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        hasScreenshot: Boolean(layer.screenshotAssetId),
      }))
  })
}

test('crée des projets iPad et Watch, filtre leurs ressources et exporte une capture Watch', async ({
  page,
}) => {
  const appleRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://developer.apple.com/')) appleRequests.push(request.url())
  })
  await waitForApp(page)
  const previousName = await page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.name ?? '',
  )

  await createTargetProject(page, 'Maquette iPad', /iPad 13 pouces.*2064×2752/, 'ipad-13')
  await page.getByLabel('Ouvrir le sélecteur de projets').click()
  await expect(page.getByText(/iPad.*2064×2752/)).toBeVisible()
  await expect(page.getByRole('button', { name: `Ouvrir « ${previousName} »` })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByLabel('Ajouter un appareil').click()
  await expect(page.getByRole('menuitem', { name: /Tablette — Ardoise/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /iPhone|Montre/ })).toHaveCount(0)
  await page.getByRole('menuitem', { name: /Tablette — Ardoise/ }).click()
  await expect
    .poll(() => activeDeviceState(page))
    .toEqual([expect.objectContaining({ model: 'tablet-slate' })])

  await page.getByRole('button', { name: 'Ouvrir les modèles' }).click()
  await expect(page.getByLabel('Sélectionner le modèle Éditorial iPad')).toBeVisible()
  await expect(page.getByLabel('Sélectionner le modèle Focus Watch')).toHaveCount(0)
  await page.getByLabel('Sélectionner le modèle Éditorial iPad').click()
  await page.getByRole('button', { name: 'Appliquer à l’écran actuel' }).click()
  const ipadDevices = await activeDeviceState(page)
  expect(ipadDevices).toEqual([expect.objectContaining({ model: 'tablet-slate' })])
  expect(ipadDevices[0].x).toBeGreaterThanOrEqual(0)
  expect(ipadDevices[0].y).toBeGreaterThanOrEqual(0)
  expect(ipadDevices[0].x + ipadDevices[0].width).toBeLessThanOrEqual(440)
  expect(ipadDevices[0].y + ipadDevices[0].height).toBeLessThanOrEqual(587)

  await createTargetProject(
    page,
    'Maquette Watch',
    /Apple Watch Series 10.*416×496/,
    'watch-series-10',
  )
  await page.getByRole('button', { name: 'Ouvrir les modèles' }).click()
  await expect(page.getByLabel('Sélectionner le modèle Focus Watch')).toBeVisible()
  await expect(page.getByLabel('Sélectionner le modèle Éditorial iPad')).toHaveCount(0)
  await page.getByLabel('Sélectionner le modèle Focus Watch').click()
  await page.getByRole('button', { name: 'Appliquer à l’écran actuel' }).click()

  await page.getByLabel('Ajouter un appareil').click()
  await expect(page.getByRole('menuitem', { name: /Montre — Halo/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /iPhone|Tablette/ })).toHaveCount(0)
  await page.getByRole('menuitem', { name: /Montre — Halo/ }).click()

  await expect(page.getByRole('link', { name: /Télécharger le DMG chez Apple/ })).toBeVisible()
  await expect(page.getByText(/fourni localement.*licence Apple/i)).toBeVisible()
  await page.getByLabel('Importer la capture de l’app').setInputFiles({
    name: 'watch-capture.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(416, 496, [34, 38, 42, 255]),
  })
  await expect
    .poll(async () => (await activeDeviceState(page)).some((device) => device.hasScreenshot))
    .toBe(true)
  expect(appleRequests).toEqual([])

  const { names, png } = await downloadFirstExportedPng(page)
  expect(names).toEqual([expect.stringMatching(/^watch-series-10\/01_/)])
  const image = decode(png)
  expect(image).toMatchObject({ width: 416, height: 496, depth: 8, channels: 3 })
})
