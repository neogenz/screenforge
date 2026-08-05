import { expect, test } from '@playwright/test'
import { addTextLayer, waitForApp } from './helpers'

test('keeps an editable memory project when IndexedDB is unavailable', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() {
        throw new DOMException('IndexedDB unavailable', 'InvalidStateError')
      },
    })
  })

  await waitForApp(page)
  await expect(page.getByRole('textbox', { name: 'Nom du projet' })).toHaveValue(
    'Projet sans titre',
  )
  await expect(
    page.getByRole('status').filter({ hasText: 'Échec de l’enregistrement' }),
  ).toBeVisible()
  const warning = page.getByRole('alert').filter({ hasText: 'Stockage local indisponible' })
  await expect(warning).toBeVisible()

  await addTextLayer(page)
  await page.clock.fastForward(5_000)
  await expect(warning).toBeVisible()
})

test('announces a delayed lazy dialog before replacing it with the focused dialog', async ({
  page,
}) => {
  let release!: () => void
  let intercepted = false
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    /\/src\/components\/export-dialog\/ExportDialog\.tsx(?:\?.*)?$/,
    async (route) => {
      intercepted = true
      await gate
      await route.continue()
    },
  )

  await waitForApp(page)
  await page.getByLabel('Ouvrir l’export').click()
  await expect.poll(() => intercepted).toBe(true)
  await expect(page.getByRole('status', { name: 'Chargement de la fenêtre' })).toBeVisible()

  release()
  const dialog = page.getByRole('dialog', { name: 'Export officiel' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeFocused()
})
