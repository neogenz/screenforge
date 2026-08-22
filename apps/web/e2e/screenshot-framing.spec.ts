import { test, expect, type Page } from '@playwright/test'
import { addDeviceLayer, waitForApp } from './helpers'
import { makeSolidPng } from './device-bezel-fixture'

/**
 * Ce que la campagne doit conserver d'une release à la suivante.
 *
 * Le contre-exemple est nommé : chez Open Screenshot Generator, remplacer une
 * capture réécrit `screenshotRect` sans condition
 * (`DeviceFrameElement.tsx:84-89`, `PropertiesPanel.tsx:660-667`), donc le
 * cadrage se reperd à chaque livraison. Ce fichier existe pour que la même
 * chose ne puisse pas arriver ici sans qu'un test tombe.
 */

interface DeviceLayerState {
  screenshotAssetId?: string
  screenshotSize?: { width: number; height: number }
  placement?: { mode: string; focusX: number; focusY: number; zoom: number }
  slot?: string
  width: number
  height: number
  x: number
  y: number
  deviceModel: string
}

async function deviceLayer(page: Page): Promise<DeviceLayerState> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].find(
      (item) => item.type === 'device-frame',
    )
    if (!layer) throw new Error('device layer missing')
    return JSON.parse(JSON.stringify(layer)) as DeviceLayerState
  })
}

async function uploadScreenshot(page: Page, width: number, height: number) {
  await page.getByLabel('Importer la capture de l’app').setInputFiles({
    name: 'capture.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(width, height, [232, 32, 48, 255]),
  })
}

test.beforeEach(async ({ page }) => {
  await waitForApp(page)
  await addDeviceLayer(page)
})

test('mesure la capture à l’import et laisse le cadrage au défaut', async ({ page }) => {
  expect(await deviceLayer(page)).not.toHaveProperty('screenshotSize')
  await expect(page.getByRole('slider', { name: 'Zoom de la capture' })).toHaveCount(0)

  await uploadScreenshot(page, 300, 600)

  await expect
    .poll(async () => deviceLayer(page))
    .toMatchObject({
      screenshotSize: { width: 300, height: 600 },
    })
  /* Aucun placement écrit : l'absence est le défaut, et le défaut est le rendu
     de toutes les versions précédentes. Écrire `cover/0.5/0.5/1` gonflerait
     chaque projet d'un objet qui ne dit rien. */
  expect(await deviceLayer(page)).not.toHaveProperty('placement')
  await expect(page.getByRole('slider', { name: 'Zoom de la capture' })).toBeVisible()
})

test('le cadrage et le rôle survivent au remplacement de la capture', async ({ page }) => {
  await uploadScreenshot(page, 300, 600)
  await expect.poll(async () => deviceLayer(page)).toHaveProperty('screenshotSize')

  await page.getByLabel('Rôle de l’écran dans la campagne').fill('Mon Budget')
  await page.getByLabel('Rôle de l’écran dans la campagne').blur()
  await expect.poll(async () => (await deviceLayer(page)).slot).toBe('mon-budget')

  await page.getByRole('button', { name: 'Contenir' }).click()
  const zoom = page.getByRole('slider', { name: 'Zoom de la capture' })
  await zoom.focus()
  for (let step = 0; step < 4; step += 1) await zoom.press('ArrowRight')
  // ponytail: le point focal est passé de Slider à UnitField (coss) — le champ
  // numérique décrémente au clavier avec ArrowDown, pas ArrowLeft (qui déplace le curseur texte).
  const focus = page.getByLabel('Point focal vertical')
  await focus.focus()
  for (let step = 0; step < 5; step += 1) await focus.press('ArrowDown')

  const framed = await deviceLayer(page)
  expect(framed.placement?.mode).toBe('contain')
  expect(framed.placement?.zoom).toBeGreaterThan(1)
  expect(framed.placement?.focusY).toBeLessThan(0.5)
  const geometry = { x: framed.x, y: framed.y, width: framed.width, height: framed.height }

  // Une nouvelle release : même écran, autre capture, autre rapport.
  await uploadScreenshot(page, 900, 900)
  await expect
    .poll(async () => (await deviceLayer(page)).screenshotSize)
    .toEqual({ width: 900, height: 900 })

  const replaced = await deviceLayer(page)
  expect(replaced.screenshotAssetId).not.toBe(framed.screenshotAssetId)
  expect(replaced.placement).toEqual(framed.placement)
  expect(replaced.slot).toBe('mon-budget')
  expect(replaced.deviceModel).toBe(framed.deviceModel)
  expect({
    x: replaced.x,
    y: replaced.y,
    width: replaced.width,
    height: replaced.height,
  }).toEqual(geometry)
})

test('le cadrage survit à un rechargement', async ({ page }) => {
  await uploadScreenshot(page, 300, 600)
  await expect.poll(async () => deviceLayer(page)).toHaveProperty('screenshotSize')
  await page.getByRole('button', { name: 'Étirer' }).click()
  await expect.poll(async () => (await deviceLayer(page)).placement?.mode).toBe('fill')

  await expect(page.getByRole('status')).toContainText('Enregistré', { timeout: 10_000 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))

  await expect.poll(async () => (await deviceLayer(page)).placement).toMatchObject({ mode: 'fill' })
  expect((await deviceLayer(page)).screenshotSize).toEqual({ width: 300, height: 600 })
})

test('un scrub continu du cadrage reste sur le chemin patch', async ({ page }) => {
  await uploadScreenshot(page, 300, 600)
  await expect.poll(async () => deviceLayer(page)).toHaveProperty('screenshotSize')

  const zoom = page.getByRole('slider', { name: 'Zoom de la capture' })
  await zoom.focus()
  // Laisse retomber les syncs de l'import avant de poser le témoin.
  await page.waitForTimeout(500)
  const before = await page.evaluate(() => window.__sfSyncVersion?.current ?? -1)
  expect(before).toBeGreaterThanOrEqual(0)

  /* Le critère de la phase 1 : pendant un drag continu du cadrage, aucune
     réconciliation complète. Le témoin est `syncVersion`, incrémenté par
     chaque full sync et par rien d'autre — les patchs sont sérialisés dans
     `use-canvas`, un tick en retard fusionne au lieu d'échouer. */
  for (let tick = 0; tick < 24; tick += 1) await zoom.press('ArrowRight')
  await expect.poll(async () => (await deviceLayer(page)).placement?.zoom).toBeGreaterThan(1)
  await page.waitForTimeout(600)

  expect(await page.evaluate(() => window.__sfSyncVersion?.current)).toBe(before)
})

test('un rôle vide de sens ne s’écrit pas', async ({ page }) => {
  const slot = page.getByLabel('Rôle de l’écran dans la campagne')
  await slot.fill('   ---   ')
  await slot.blur()
  await expect.poll(async () => (await deviceLayer(page)).slot).toBeUndefined()

  await slot.fill('Réglages Généraux')
  await slot.blur()
  // Les accents se décomposent : « réglages » et « reglages » sont un seul rôle.
  await expect.poll(async () => (await deviceLayer(page)).slot).toBe('reglages-generaux')
})
