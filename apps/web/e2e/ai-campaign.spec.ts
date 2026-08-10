import { test, expect, type Page } from '@playwright/test'
import { addScreen, addTextLayer, waitForApp } from './helpers'

/**
 * La campagne composée d'un coup, puis reprise comme le reste.
 *
 * Ce que la phase doit prouver : ce qui sort du plan est fait de calques
 * ScreenForge ordinaires — pas une image aplatie, pas du JSON opaque — et le
 * lot entier vaut un seul pas d'annulation. La retouche, elle, ne sort jamais
 * de l'écran visé.
 */

interface ScreenState {
  id: string
  name: string
  background: { type: string; color?: string }
  layers: { type: string; content?: string; color?: string; slot?: string }[]
}

async function screens(page: Page): Promise<ScreenState[]> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    return JSON.parse(
      JSON.stringify(
        (project?.screens ?? []).map((screen) => ({
          id: screen.id,
          name: screen.name,
          background: screen.background,
          layers: screen.layers.map((layer) => ({
            type: layer.type,
            content: (layer as { content?: string }).content,
            color: (layer as { color?: string }).color,
            slot: (layer as { slot?: string }).slot,
          })),
        })),
      ),
    ) as ScreenState[]
  })
}

async function historyDepth(page: Page): Promise<number> {
  return page.evaluate(() => window.__sfStores?.useHistoryStore.getState().past.length ?? 0)
}

async function openCampaignDialog(page: Page) {
  await page.getByRole('button', { name: 'Composer une campagne' }).click()
  await expect(page.getByRole('dialog', { name: 'Composer une campagne' })).toBeVisible()
}

test('compose une campagne en calques réels, défaisable d’un seul coup', async ({ page }) => {
  await waitForApp(page)
  const before = await screens(page)
  const depth = await historyDepth(page)

  await openCampaignDialog(page)
  await page.getByLabel('Nom de l’application').fill('Cadence')
  await page.getByLabel('Ce qu’elle fait, en une phrase').fill('Le budget dans une poche')
  await page.getByRole('radio', { name: 'Contrasté' }).click()

  // Rien n'est posé avant que le plan n'ait été relu.
  await page.getByRole('button', { name: 'Proposer un plan' }).click()
  await expect(page.getByText('Plan proposé')).toBeVisible()
  expect(await screens(page)).toHaveLength(before.length)

  await page.getByRole('button', { name: /Poser 1 planche/ }).click()
  await expect(page.getByRole('dialog', { name: 'Composer une campagne' })).toBeHidden()

  const after = await screens(page)
  expect(after).toHaveLength(before.length + 1)
  const composed = after[after.length - 1]
  expect(composed.name).toBe('Cadence')
  // De vrais calques : un texte éditable et un appareil, pas une image aplatie.
  expect(composed.layers.map((layer) => layer.type)).toEqual(['text', 'device-frame'])
  expect(composed.layers[0].content).toBe('Le budget dans une poche')
  expect(composed.layers[0].color).toBe('#ffffff')
  expect(composed.layers[1].slot).toBe('cadence')
  expect(composed.background).toEqual({ type: 'solid', color: '#101114' })

  // Un run accepté vaut un pas d'annulation, pas quatre.
  expect(await historyDepth(page)).toBe(depth + 1)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await screens(page)).length).toBe(before.length)
})

test('l’harmonisation ne sort pas de l’écran courant', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)
  await addScreen(page)
  await addTextLayer(page)

  const before = await screens(page)
  expect(before).toHaveLength(2)

  await openCampaignDialog(page)
  await page.getByRole('radio', { name: 'Nocturne' }).click()
  await page.getByRole('button', { name: 'Harmoniser cet écran' }).click()
  await expect(page.getByRole('dialog', { name: 'Composer une campagne' })).toBeHidden()

  const after = await screens(page)
  expect(after[1].background).toEqual({ type: 'solid', color: '#1b1f3b' })
  expect(after[1].layers[0].color).toBe('#eef1ff')
  // Le premier écran n'a pas été touché : ni son fond, ni l'encre de son texte.
  expect(after[0]).toEqual(before[0])
})
