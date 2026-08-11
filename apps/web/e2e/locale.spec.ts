import { test, expect, type Page } from '@playwright/test'
import { addTextLayer, waitForApp } from './helpers'

/**
 * La revue d'une langue, et le débordement qui l'arrête.
 *
 * Ce que la phase doit prouver de bout en bout : une langue ne duplique aucun
 * écran, une traduction trop longue est nommée sur sa propre ligne, l'export de
 * cette langue est refusé tant qu'elle déborde, et la correction lève le refus.
 * La langue d'origine, elle, reste exportable pendant tout ce temps — une
 * variante fautive n'a jamais bloqué le projet.
 */

interface LocaleState {
  code: string
  name: string
  script: string
  texts: Record<string, { value: string; reviewed: boolean }>
}

async function locales(page: Page): Promise<LocaleState[]> {
  return page.evaluate(() =>
    JSON.parse(
      JSON.stringify(window.__sfStores?.useProjectStore.getState().project?.locales ?? []),
    ),
  )
}

async function screenCount(page: Page): Promise<number> {
  return page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.screens.length ?? 0,
  )
}

function localeDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Langues' })
}

async function openLocales(page: Page) {
  await page.getByRole('button', { name: 'Ouvrir les langues' }).click()
  await expect(localeDialog(page)).toBeVisible()
}

/** La dernière ligne de revue : celle du texte que le test vient d'ajouter. */
function lastVariantField(page: Page) {
  return localeDialog(page).locator('li').last().getByRole('textbox')
}

test('une langue se relit, déborde, et bloque son seul export', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)
  const screensBefore = await screenCount(page)

  await openLocales(page)
  const dialog = localeDialog(page)
  await dialog.getByLabel('Code').fill('de')
  await dialog.getByLabel('Nom').fill('Allemand')
  await dialog.getByRole('button', { name: 'Ajouter' }).click()

  // La langue ne duplique rien : elle ne porte que des textes.
  await expect.poll(async () => (await locales(page)).length).toBe(1)
  expect(await screenCount(page)).toBe(screensBefore)
  const created = (await locales(page))[0]
  expect(created).toMatchObject({ code: 'de', name: 'Allemand', script: 'latin' })
  expect(Object.values(created.texts).every((text) => !text.reviewed)).toBe(true)

  // Une traduction qui ne tient plus est nommée sur sa ligne.
  await lastVariantField(page).fill(
    'Ein ausgesprochen langer deutscher Satz der in dieser Textbox niemals Platz finden wird',
  )
  await expect(dialog.getByRole('alert').filter({ hasText: 'px de texte' })).toBeVisible()
  await expect(dialog.getByText(/ne peut pas sortir/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Fermer', exact: true }).last().click()

  // L'export de la langue d'origine reste possible ; celui de la variante non.
  await page.getByLabel('Ouvrir l’export').click()
  const exportDialog = page.getByRole('dialog', { name: 'Export officiel' })
  await expect(exportDialog).toBeVisible()
  const exportButton = exportDialog.getByRole('button', { name: /Exporter (le ZIP|les PNG)/ })
  await expect(exportButton).toBeEnabled()

  await exportDialog.getByLabel('Langue exportée').click()
  await page.getByRole('option', { name: 'Allemand' }).click()
  await expect(exportDialog.getByRole('alert')).toContainText('Langues')
  await expect(exportButton).toBeDisabled()

  // Corrigée, la variante repasse.
  await exportDialog.getByRole('button', { name: 'Annuler' }).click()
  await openLocales(page)
  await lastVariantField(page).fill('Kurz')
  await expect(dialog.getByRole('alert').filter({ hasText: 'px de texte' })).toBeHidden()
  await expect(dialog.getByText(/est exportable/)).toBeVisible()
})
