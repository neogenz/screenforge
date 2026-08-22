import { expect, test, type Page } from '@playwright/test'
import { waitForApp } from './helpers'
import { makeSolidPng } from './device-bezel-fixture'

/**
 * La planche sans écran, et ce que ses deux boutons déclenchent réellement.
 *
 * `project.screens.length === 0` n'arrive jamais par la suppression du
 * dernier écran — `removeScreen` la refuse — donc chaque test la force via le
 * store, après le premier rendu normal de `waitForApp` (qui attend un fond
 * peint, impossible sans écran).
 */
async function emptyProject(page: Page): Promise<void> {
  await waitForApp(page)
  await page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    if (!project) throw new Error('Aucun projet à vider')
    window.__sfStores?.useProjectStore.setState({
      project: { ...project, screens: [], activeScreenId: '' },
    })
  })
}

function capture(name: string, width: number): { name: string; mimeType: string; buffer: Buffer } {
  return {
    name,
    mimeType: 'image/png',
    buffer: makeSolidPng(width, width * 2, [32, 96, 200, 255]),
  }
}

test('la planche sans écran invite à importer des captures', async ({ page }) => {
  await emptyProject(page)

  const empty = page.getByRole('status').filter({ hasText: 'Commencez par vos captures' })
  await expect(empty).toBeVisible()
  await expect(
    empty.getByText('Déposez des PNG du simulateur, un écran par capture.'),
  ).toBeVisible()
  await expect(empty.getByRole('button', { name: 'Importer des captures' })).toBeVisible()
  await expect(empty.getByRole('button', { name: 'Partir d’un modèle' })).toBeVisible()
})

test('« Partir d’un modèle » depuis la planche vide ouvre les modèles', async ({ page }) => {
  await emptyProject(page)
  await page.getByRole('button', { name: 'Partir d’un modèle' }).click()
  await expect(page.getByRole('dialog', { name: 'Modèles de mise en page' })).toBeVisible()
})

test('importer 3 captures depuis la planche vide crée 3 écrans', async ({ page }) => {
  await emptyProject(page)

  // Pas de `getByLabel` : l'input masqué ne porte aucun nom accessible (voir
  // `empty-stage.tsx`), il n'est ciblé que par le bouton qui le déclenche.
  await page
    .locator('main input[type="file"]')
    .setInputFiles([capture('01.png', 400), capture('02.png', 400), capture('03.png', 400)])

  const dialog = page.getByRole('dialog', { name: 'Générer les visuels App Store' })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Nom de l’app').fill('Cadence')
  await dialog.getByRole('button', { name: 'Proposer 3 visuels' }).click()
  await expect(dialog.getByRole('button', { name: 'Ajouter 3 visuels' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Ajouter 3 visuels' }).click()

  await expect(dialog).not.toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sfStores?.useProjectStore.getState().project?.screens.length ?? 0,
      ),
    )
    .toBe(3)
})

test('les panneaux affichent leur état vide sur une planche sans écran', async ({ page }) => {
  await emptyProject(page)

  await expect(
    page.getByRole('complementary', { name: 'Propriétés' }).getByText('Sélectionnez un calque'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Partir d’un modèle' }).click()
  await expect(page.getByText('Aucun gabarit enregistré')).toBeVisible()
})
