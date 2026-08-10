import { test, expect, type Page } from '@playwright/test'
import { addTextLayer, transformInput, waitForApp } from './helpers'

/**
 * Le lot livré : figé, vérifiable, et indifférent à ce que le projet devient.
 *
 * C'est la propriété que la phase 5 doit tenir : une release est un fait daté,
 * pas une vue du projet. Modifier une planche après coup doit apparaître dans
 * le diff et nulle part ailleurs.
 */

interface ReleaseState {
  id: string
  name: string
  files: { path: string; sha256: string }[]
  snapshot: unknown
}

async function releases(page: Page): Promise<ReleaseState[]> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    return JSON.parse(JSON.stringify(project?.releases ?? [])) as ReleaseState[]
  })
}

async function openReleaseDialog(page: Page) {
  await page.getByRole('button', { name: 'Ouvrir les releases' }).click()
  await expect(page.getByRole('dialog', { name: 'Releases' })).toBeVisible()
}

test('fige un lot, le vérifie, et le laisse intact quand le projet bouge', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)

  await openReleaseDialog(page)
  await page.getByLabel('Nom du lot').fill('1.0.0')
  await page.getByRole('button', { name: 'Figer une release' }).click()

  await expect.poll(async () => (await releases(page)).length, { timeout: 30_000 }).toBe(1)
  const frozen = (await releases(page))[0]
  // Une planche par écran et par format exporté : ici un seul des deux.
  expect(frozen.name).toBe('1.0.0')
  expect(frozen.files).toHaveLength(1)
  expect(frozen.files[0].path).toMatch(/^6\.9\/01_/)
  expect(frozen.files[0].sha256).toMatch(/^[a-f0-9]{64}$/)

  // Vérifier, c'est rejouer l'instantané et recomparer les empreintes.
  await page.getByRole('button', { name: 'Vérifier' }).click()
  await expect(page.getByText(/se rejouent à l’identique/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Le projet est exactement dans l’état figé/)).toBeVisible()

  // Échap plutôt qu'un clic : « Fermer » nomme aussi la croix de l'en-tête.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Releases' })).toBeHidden()

  /* Le projet continue de vivre : le texte se déplace. La release, elle, ne
     doit rien en savoir. */
  const before = JSON.stringify(frozen.snapshot)
  await transformInput(page, 0).fill('42')
  await transformInput(page, 0).press('Enter')

  await openReleaseDialog(page)
  const after = (await releases(page))[0]
  expect(JSON.stringify(after.snapshot)).toBe(before)
  expect(after.files[0].sha256).toBe(frozen.files[0].sha256)

  // Et le changement apparaît là où il doit : dans le diff, pas dans le lot.
  await expect(page.getByText(/changement.? structurel/)).toBeVisible()
  await expect(page.getByText(/position X/)).toBeVisible()

  // Rejouée après la modification, la release se vérifie toujours : c'est son
  // instantané qui est rendu, jamais le projet d'aujourd'hui.
  await page.getByRole('button', { name: 'Vérifier' }).click()
  await expect(page.getByText(/se rejouent à l’identique/)).toBeVisible({ timeout: 30_000 })
})

test('un lot figé survit au rechargement et se retire à la demande', async ({ page }) => {
  await waitForApp(page)
  await openReleaseDialog(page)
  await page.getByLabel('Nom du lot').fill('2.0.0')
  await page.getByRole('button', { name: 'Figer une release' }).click()
  /* Le toast suit l'écriture durable : l'attendre, c'est attendre que le lot
     soit sur disque, sans dépendre du délai de l'autosave. */
  await expect(page.getByText(/Release « 2\.0\.0 » figée/)).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => (await releases(page)).length).toBe(1)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))
  expect(await releases(page)).toHaveLength(1)
  expect((await releases(page))[0].name).toBe('2.0.0')

  await openReleaseDialog(page)
  await page.getByRole('button', { name: 'Retirer' }).click()
  await expect.poll(async () => (await releases(page)).length).toBe(0)
})
