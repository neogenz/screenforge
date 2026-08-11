import { expect, test } from '@playwright/test'
import { waitForApp } from './helpers'
import { THUMBNAIL_WIDTH } from '../src/lib/stage'

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
})
