import { test, expect, type Page } from '@playwright/test'
import { addDeviceLayer, addScreen, waitForApp } from './helpers'
import { makeSolidPng } from './device-bezel-fixture'

/**
 * La reprise d'une campagne : dix captures changent, rien d'autre ne bouge.
 *
 * Ce que ce fichier tient : le lot est une opération, pas dix. Un pas
 * d'annulation le défait entièrement, un fichier illisible ne laisse aucune
 * trace, et le cadrage réglé à la release précédente est toujours là après.
 */

interface DeviceState {
  screenshotAssetId?: string
  screenshotSize?: { width: number; height: number }
  placement?: { zoom: number }
  slot?: string
}

async function devices(page: Page): Promise<DeviceState[]> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const layers = (project?.screens ?? []).flatMap((screen) =>
      screen.layers.filter((layer) => layer.type === 'device-frame'),
    )
    return JSON.parse(JSON.stringify(layers)) as DeviceState[]
  })
}

async function setUpScreen(page: Page, slot: string, size: [number, number]) {
  await addDeviceLayer(page)
  const role = page.getByLabel('Rôle de l’écran dans la campagne')
  await role.fill(slot)
  await role.blur()
  await page.getByLabel('Importer la capture de l’app').setInputFiles({
    name: `origine-${slot}.png`,
    mimeType: 'image/png',
    buffer: makeSolidPng(size[0], size[1], [40, 40, 40, 255]),
  })
  await expect.poll(async () => (await devices(page)).at(-1)?.screenshotSize?.width).toBe(size[0])
}

function delivery(name: string, width: number) {
  return {
    name,
    mimeType: 'image/png',
    buffer: makeSolidPng(width, width * 2, [232, 32, 48, 255]),
  }
}

async function openRefreshDialog(page: Page) {
  await page.getByRole('button', { name: 'Actualiser les captures' }).click()
  await expect(page.getByRole('dialog', { name: 'Actualiser les captures' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await waitForApp(page)
})

test('un lot multi-écrans se pose et se défait en un seul pas', async ({ page }) => {
  await setUpScreen(page, 'budget', [300, 600])
  // Un cadrage réglé avant la livraison : c'est lui qui ne doit pas bouger.
  const zoom = page.getByRole('slider', { name: 'Zoom de la capture' })
  await zoom.focus()
  for (let step = 0; step < 4; step += 1) await zoom.press('ArrowRight')
  const framed = (await devices(page))[0].placement?.zoom
  expect(framed).toBeGreaterThan(1)

  await addScreen(page)
  await setUpScreen(page, 'reglages', [310, 620])
  const before = await devices(page)
  expect(before).toHaveLength(2)

  await openRefreshDialog(page)
  await page
    .getByLabel('Captures à poser')
    .setInputFiles([delivery('budget.png', 400), delivery('02_Réglages.png', 410)])

  // L'appariement est proposé, pas demandé : les deux rôles sont reconnus, le
  // rang du simulateur devant « Réglages » n'empêche rien.
  const confirm = page.getByRole('button', { name: /^Remplacer 2 captures/ })
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect
    .poll(async () => (await devices(page)).map((layer) => layer.screenshotSize?.width))
    .toEqual([400, 410])
  const after = await devices(page)
  expect(after[0].placement?.zoom).toBe(framed)
  expect(after[0].slot).toBe('budget')
  expect(after[0].screenshotAssetId).not.toBe(before[0].screenshotAssetId)

  // Un seul ⌘Z pour les deux écrans : c'est toute la raison d'être de la
  // transaction. Deux pas voudraient dire que le lot n'en était pas un.
  await page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(async () => (await devices(page)).map((layer) => layer.screenshotSize?.width))
    .toEqual([300, 310])
  expect((await devices(page))[0].placement?.zoom).toBe(framed)
})

test('un fichier illisible laisse le projet exactement tel quel', async ({ page }) => {
  await setUpScreen(page, 'budget', [300, 600])
  const before = await devices(page)

  await openRefreshDialog(page)
  await page
    .getByLabel('Captures à poser')
    .setInputFiles([
      delivery('budget.png', 400),
      { name: 'corrompu.png', mimeType: 'image/png', buffer: Buffer.from('pas une image') },
    ])

  await expect(page.getByRole('alert')).toContainText('illisible')
  /* Le lot entier est refusé, pas seulement le fichier fautif : accepter la
     moitié d'une livraison est exactement l'état à mi-chemin que la
     transaction existe pour interdire. */
  await expect(page.getByRole('button', { name: /^Remplacer 0 capture/ })).toBeDisabled()
  expect(await devices(page)).toEqual(before)
})

test('deux fichiers pour un même rôle attendent une décision', async ({ page }) => {
  await setUpScreen(page, 'budget', [300, 600])
  const before = await devices(page)

  await openRefreshDialog(page)
  await page
    .getByLabel('Captures à poser')
    .setInputFiles([delivery('budget.png', 400), delivery('01_budget.png', 410)])

  await expect(page.getByRole('button', { name: /^Remplacer 0 capture/ })).toBeDisabled()
  await expect(page.getByText(/Rôle « budget » réclamé par 2 fichiers/)).toBeVisible()
  expect(await devices(page)).toEqual(before)

  // La correction manuelle tranche ce que la règle a refusé de trancher.
  await page.getByRole('combobox', { name: /^Capture pour / }).click()
  await page.getByRole('option', { name: '01_budget.png' }).click()
  await page.getByRole('button', { name: /^Remplacer 1 capture/ }).click()

  await expect.poll(async () => (await devices(page))[0].screenshotSize?.width).toBe(410)
})
