import { test, expect, type Page } from '@playwright/test'
import { addScreen, addTextLayer, waitForApp } from './helpers'

/**
 * Les visuels de la fiche générés d'un coup, puis repris comme le reste.
 *
 * Ce que la phase doit prouver : ce qui sort du plan est fait de calques
 * ScreenForge ordinaires — pas une image aplatie, pas du JSON opaque — et le
 * lot entier vaut un seul pas d'annulation. Le restylage, lui, ne sort jamais
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

const DIALOG = 'Générer les visuels App Store'

async function openCampaignDialog(page: Page) {
  await page.getByRole('button', { name: DIALOG }).click()
  await expect(page.getByRole('dialog', { name: DIALOG })).toBeVisible()
}

test('génère des visuels en calques réels, défaisables d’un seul coup', async ({ page }) => {
  await waitForApp(page)
  const before = await screens(page)
  const depth = await historyDepth(page)

  await openCampaignDialog(page)
  await page.getByLabel('Nom', { exact: true }).fill('Cadence')
  await page.getByLabel('Ce qu’elle fait, en une phrase').fill('Le budget dans une poche')
  await page.getByRole('radio', { name: 'Contrasté' }).click()
  // Le nombre commande, et il ne vient d'aucune capture : c'est tout l'intérêt
  // du champ, puisque personne n'a dix captures prêtes en commençant.
  await page.getByLabel('Combien de visuels').click()
  await page.getByRole('option', { name: '3 visuels' }).click()

  // Rien n'est posé avant que le plan n'ait été relu.
  await page.getByRole('button', { name: 'Proposer 3 visuels' }).click()
  await expect(page.getByRole('heading', { name: 'À relire avant d’ajouter' })).toBeVisible()
  expect(await screens(page)).toHaveLength(before.length)

  await page.getByRole('button', { name: 'Ajouter 3 visuels' }).click()
  await expect(page.getByRole('dialog', { name: DIALOG })).toBeHidden()

  const after = await screens(page)
  expect(after).toHaveLength(before.length + 3)
  const composed = after[before.length]
  expect(composed.name).toBe('Cadence 1')
  /* De vrais calques : un texte éditable et un appareil, pas une image aplatie.
     Le texte est posé en dernier, et c'est l'ordre qui compte — un visuel où
     une composition passe par-dessus l'accroche est un visuel raté. */
  expect(composed.layers.map((layer) => layer.type)).toEqual(['device-frame', 'text'])
  const headline = composed.layers[composed.layers.length - 1]
  expect(headline.content).toBe('Le budget dans une poche')
  expect(headline.color).toBe('#ffffff')
  expect(composed.layers[0].slot).toBe('ecran-1')
  /* Le fond vient de l'archétype du rang, jamais de l'aplat de la direction :
     « Contrasté » vaut #101114, et l'ouverture en fait un voile. Un lot de dix
     aplats identiques est exactement le défaut que la refonte a supprimé. */
  expect(composed.background.type).toBe('linear-gradient')
  // La phrase du brief n'est posée qu'une fois : répétée, elle serait un
  // filigrane à effacer sur chacun des visuels suivants.
  const second = after[before.length + 1].layers
  expect(second[second.length - 1].content).toBe('Cadence')
  // Deux visuels voisins ne portent jamais la même composition.
  expect(after[before.length + 1].background).not.toEqual(composed.background)

  // Un run accepté vaut un pas d'annulation, pas neuf.
  expect(await historyDepth(page)).toBe(depth + 1)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await screens(page)).length).toBe(before.length)
})

test('le plan se relit visuel par visuel, et c’est ce qu’on a relu qui est posé', async ({
  page,
}) => {
  await waitForApp(page)
  const before = await screens(page)

  await openCampaignDialog(page)
  await page.getByLabel('Nom', { exact: true }).fill('Cadence')
  await page.getByLabel('Ce qu’elle fait, en une phrase').fill('Le budget dans une poche')
  await page.getByLabel('Combien de visuels').click()
  await page.getByRole('option', { name: '3 visuels' }).click()
  await page.getByRole('button', { name: 'Proposer 3 visuels' }).click()

  // La bande donne un visuel par onglet, nommé par son accroche : au-delà de
  // trois, « le troisième » ne désigne plus rien.
  const strip = page.getByRole('tablist', { name: 'Visuels proposés' })
  await expect(strip.getByRole('tab')).toHaveCount(3)
  await expect(strip.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true')

  await strip.getByRole('tab', { name: 'Visuel 2 : Cadence' }).click()
  const headline = page.getByLabel('Accroche du visuel 2')
  await expect(headline).toHaveValue('Cadence')
  await headline.fill('Tout tient dans la poche')
  // Ce qui est corrigé ici se voit dans la bande avant d'être posé.
  await expect(strip.getByRole('tab').nth(1)).toHaveAttribute(
    'aria-label',
    'Visuel 2 : Tout tient dans la poche',
  )

  await strip.getByRole('tab').nth(2).click()
  await page.getByRole('button', { name: 'Retirer' }).click()
  await expect(strip.getByRole('tab')).toHaveCount(2)

  await page.getByRole('button', { name: 'Ajouter 2 visuels' }).click()
  await expect(page.getByRole('dialog', { name: DIALOG })).toBeHidden()

  const after = await screens(page)
  expect(after).toHaveLength(before.length + 2)
  // L'accroche est le dernier calque posé : rien ne la recouvre.
  const laid = (index: number) => after[index].layers.at(-1)?.content
  expect(laid(before.length)).toBe('Le budget dans une poche')
  expect(laid(before.length + 1)).toBe('Tout tient dans la poche')
})

test('le restylage ne sort pas de l’écran courant', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)
  await addScreen(page)
  await addTextLayer(page)

  const before = await screens(page)
  expect(before).toHaveLength(2)

  await openCampaignDialog(page)
  await page.getByRole('radio', { name: 'Nocturne' }).click()
  await page.getByRole('button', { name: /^Repeindre/ }).click()
  await expect(page.getByRole('dialog', { name: DIALOG })).toBeHidden()

  const after = await screens(page)
  /* Harmoniser pose le fond d'un visuel de campagne, pas l'aplat de la
     palette : le geste promet « comme la campagne », et la campagne n'en pose
     plus d'uni. */
  expect(after[1].background.type).toBe('linear-gradient')
  expect(after[1].layers[0].color).toBe('#eef1ff')
  // Le premier écran n'a pas été touché : ni son fond, ni l'encre de son texte.
  expect(after[0]).toEqual(before[0])
})
