import { expect, test, type Page } from '@playwright/test'
import { addScreen, openAndroidProject, waitForApp } from './helpers'
import { THUMBNAIL_WIDTH } from '../src/lib/stage'

function tile(page: Page, name: string) {
  return page.locator(`button[aria-label="Activer ${name}"]`)
}

async function screenNames(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      window.__sfStores?.useProjectStore.getState().project?.screens.map((screen) => screen.name) ??
      [],
  )
}

/**
 * Renommer un écran depuis la pellicule.
 *
 * Le champ était posé sur le bas de l'aperçu, donc large de la vignette : une
 * cinquantaine de pixels, six caractères d'un nom qui en compte vingt. La bande
 * ne pouvait pas l'élargir — elle épingle `overflow-y: hidden` pour ne pas voir
 * apparaître une barre verticale, et rien n'en sort en flux. Il se détache donc
 * par un portail, et c'est ce que mesure le premier test : pas « le champ
 * existe », mais « le champ est plus large que la tuile ».
 */
test.describe('filmstrip rename', () => {
  test('renders Android thumbnails at the 9:16 board ratio', async ({ page }) => {
    await waitForApp(page)
    await openAndroidProject(page)
    const preview = tile(page, 'Écran 1')
    await expect.poll(async () => Math.round((await preview.boundingBox())?.width ?? 0)).toBe(65)
    await expect.poll(async () => Math.round((await preview.boundingBox())?.height ?? 0)).toBe(116)
  })

  test('names every screen, and never leaves one anonymous', async ({ page }) => {
    await waitForApp(page)
    const strip = page.getByRole('group', { name: 'Écrans' })

    // La rangée est écrite dès le départ, sans qu'aucun renommage l'ait
    // déclenchée : c'est ce qui faisait qu'une tuile sur deux portait une
    // étiquette et l'autre du vide.
    await expect(strip.getByText('Écran 1', { exact: true })).toBeVisible()

    await page.locator('button[aria-label="Activer Écran 1"]').dblclick()
    const field = page.getByRole('textbox', { name: 'Nom de l’écran' })
    await expect(field).toBeVisible()

    const box = await field.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(THUMBNAIL_WIDTH * 2)

    // Le champ s'ouvre sur le nom affiché, pas vide : le vide était un état par
    // accident, qui demandait de deviner qu'une invite grise valait un nom.
    await expect(field).toHaveValue('Écran 1')

    await field.fill('Onboarding')
    await page.keyboard.press('Enter')
    await expect(page.locator('button[aria-label="Activer Onboarding"]')).toBeVisible()
    await expect(strip.getByText('Onboarding', { exact: true })).toBeVisible()

    // Vidé, il retombe sur son rang — un écran n'est jamais sans nom.
    await page.locator('button[aria-label="Activer Onboarding"]').dblclick()
    await page.getByRole('textbox', { name: 'Nom de l’écran' }).fill('')
    await page.keyboard.press('Enter')
    await expect(page.locator('button[aria-label="Activer Écran 1"]')).toBeVisible()
    await expect(strip.getByText('Écran 1', { exact: true })).toBeVisible()
  })

  test('escape leaves the name alone', async ({ page }) => {
    await waitForApp(page)

    await page.locator('button[aria-label="Activer Écran 1"]').dblclick()
    await page.getByRole('textbox', { name: 'Nom de l’écran' }).fill('Jeté')
    await page.keyboard.press('Escape')

    await expect(page.getByRole('textbox', { name: 'Nom de l’écran' })).toHaveCount(0)
    await expect(page.locator('button[aria-label="Activer Écran 1"]')).toBeVisible()
    await expect(page.locator('button[aria-label="Activer Jeté"]')).toHaveCount(0)
  })

  test('←→ déplacent le focus de vignette en vignette, Entrée active', async ({ page }) => {
    await waitForApp(page)
    await addScreen(page)
    await addScreen(page)

    await tile(page, 'Écran 1').focus()
    await page.keyboard.press('ArrowRight')
    await expect(tile(page, 'Écran 2')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(tile(page, 'Écran 3')).toBeFocused()
    // En bout de rangée, → ne bouge plus.
    await page.keyboard.press('ArrowRight')
    await expect(tile(page, 'Écran 3')).toBeFocused()

    await page.keyboard.press('Enter')
    expect(
      await page.evaluate(
        () =>
          window.__sfStores?.useProjectStore
            .getState()
            .project?.screens.findIndex(
              (screen) =>
                screen.id === window.__sfStores?.useProjectStore.getState().project?.activeScreenId,
            ) ?? -1,
      ),
    ).toBe(2)

    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(tile(page, 'Écran 1')).toBeFocused()
  })

  test('un renommage validé au clavier rend le focus à la vignette', async ({ page }) => {
    await waitForApp(page)

    await tile(page, 'Écran 1').dblclick()
    const field = page.getByRole('textbox', { name: 'Nom de l’écran' })
    await field.fill('Onboarding')
    await page.keyboard.press('Enter')
    await expect(tile(page, 'Onboarding')).toBeFocused()
  })
})

/**
 * Retenir plusieurs écrans, et n'en éditer qu'un.
 *
 * Deux états qui se ressemblent et ne disent pas la même chose : l'écran
 * *courant* est celui que la scène montre et que l'on compose, les écrans
 * *retenus* sont ceux que la prochaine action touchera. Ils coïncident tant
 * qu'on n'en désigne qu'un, et c'est quand ils divergent que tout se joue — un
 * menu qui promet « Supprimer » là où il en efface trois est le défaut que ces
 * tests surveillent, avec la règle du repère : le citron ne se pose que sur le
 * courant, jamais sur la troupe.
 */
test.describe('filmstrip selection', () => {
  test('multi-selection acts on the group, and says so before it does', async ({ page }) => {
    await waitForApp(page)
    await addScreen(page)
    await addScreen(page)
    expect(await screenNames(page)).toEqual(['Écran 1', 'Écran 2', 'Écran 3'])

    await tile(page, 'Écran 1').click()
    await expect(tile(page, 'Écran 1')).toHaveAttribute('aria-current', 'true')

    // ⌘ retient un second écran sans lâcher le premier. L'écran courant suit ce
    // qu'on vient de désigner ; les deux sont « pressed », le troisième non.
    await tile(page, 'Écran 3').click({ modifiers: ['Meta'] })
    await expect(tile(page, 'Écran 1')).toHaveAttribute('aria-pressed', 'true')
    await expect(tile(page, 'Écran 3')).toHaveAttribute('aria-pressed', 'true')
    await expect(tile(page, 'Écran 2')).toHaveAttribute('aria-pressed', 'false')
    // Un seul repère « vous êtes ici », même à deux retenus.
    await expect(tile(page, 'Écran 3')).toHaveAttribute('aria-current', 'true')
    await expect(tile(page, 'Écran 1')).not.toHaveAttribute('aria-current', 'true')

    // Le menu annonce la portée avant de l'exercer.
    await tile(page, 'Écran 3').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Supprimer 2 écrans' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Dupliquer 2 écrans' })).toBeVisible()
    // Un nom ne se partage pas : renommer reste au singulier.
    await expect(page.getByRole('menuitem', { name: 'Renommer' })).toBeVisible()

    await page.getByRole('menuitem', { name: 'Supprimer 2 écrans' }).click()
    // La confirmation redit la quantité ; Annuler ne touche à rien.
    const confirm = page.getByRole('alertdialog', { name: 'Supprimer 2 écrans ?' })
    await confirm.getByRole('button', { name: 'Annuler' }).click()
    await expect(confirm).toBeHidden()
    expect(await screenNames(page)).toEqual(['Écran 1', 'Écran 2', 'Écran 3'])
    await tile(page, 'Écran 3').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Supprimer 2 écrans' }).click()
    await confirm.getByRole('button', { name: 'Supprimer 2 écrans' }).click()
    expect(await screenNames(page)).toEqual(['Écran 2'])

    // Un geste, un pas d'annulation — pas deux suppressions à défaire.
    await page.keyboard.press('Meta+z')
    expect(await screenNames(page)).toEqual(['Écran 1', 'Écran 2', 'Écran 3'])
  })

  test('shift extends from the screen being edited, and leaves it there', async ({ page }) => {
    await waitForApp(page)
    await addScreen(page)
    await addScreen(page)

    await tile(page, 'Écran 1').click()
    await tile(page, 'Écran 3').click({ modifiers: ['Shift'] })

    for (const name of ['Écran 1', 'Écran 2', 'Écran 3']) {
      await expect(tile(page, name)).toHaveAttribute('aria-pressed', 'true')
    }
    // L'ancre ne bouge pas : la scène reste sur l'écran qu'on composait, et un
    // second ⇧ clic rétrécit la même plage au lieu d'en ouvrir une autre.
    await expect(tile(page, 'Écran 1')).toHaveAttribute('aria-current', 'true')
    await tile(page, 'Écran 2').click({ modifiers: ['Shift'] })
    await expect(tile(page, 'Écran 3')).toHaveAttribute('aria-pressed', 'false')
  })

  test('a plain click drops the group back to one screen', async ({ page }) => {
    await waitForApp(page)
    await addScreen(page)

    await tile(page, 'Écran 1').click()
    await tile(page, 'Écran 2').click({ modifiers: ['Meta'] })
    await expect(tile(page, 'Écran 1')).toHaveAttribute('aria-pressed', 'true')

    await tile(page, 'Écran 2').click()
    await expect(tile(page, 'Écran 1')).toHaveAttribute('aria-pressed', 'false')
    await tile(page, 'Écran 2').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Supprimer', exact: true })).toBeVisible()
  })
})
