import { expect, test } from '@playwright/test'
import { waitForApp } from './helpers'

test('creates, composes and reopens a Google Play phone project', async ({ page }) => {
  await waitForApp(page)

  const projectTrigger = page.getByRole('button', { name: 'Ouvrir le sélecteur de projets' })
  await projectTrigger.click()
  await page.getByRole('button', { name: 'Nouveau projet…' }).click()

  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' })
  const name = dialog.getByRole('textbox', { name: 'Nom du nouveau projet' })
  await expect(name).toBeFocused()
  await name.fill('Campagne Android')
  await dialog.getByRole('button', { name: /Google Play · téléphone/ }).click()
  await dialog.getByRole('button', { name: 'Créer' }).click()

  await expect
    .poll(() => page.evaluate(() => window.__sfStores?.useProjectStore.getState().project?.target))
    .toBe('google-play-phone')
  await expect(projectTrigger).toBeFocused()

  await projectTrigger.click()
  await expect(page.getByText('Google Play · téléphone', { exact: true })).toBeVisible()
  await projectTrigger.click()

  await page.locator('button[aria-label="Ajouter un cadre de téléphone"]').click()
  await page.getByRole('menuitem', { name: /Téléphone Android/ }).click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__sfStores?.useProjectStore.getState().project
        const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
        return screen?.layers.find((layer) => layer.type === 'device-frame')?.deviceModel
      }),
    )
    .toBe('android-phone')

  await page.getByRole('button', { name: 'Ouvrir les modèles' }).click()
  const templates = page.getByRole('dialog', { name: 'Modèles de mise en page' })
  await templates.getByRole('button', { name: 'Sélectionner le modèle Hero' }).click()
  await templates.getByRole('button', { name: 'Appliquer à l’écran actuel' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__sfStores?.useProjectStore.getState().project
        const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
        return screen?.layers
          .filter((layer) => layer.type === 'device-frame')
          .map((layer) => layer.deviceModel)
      }),
    )
    .toEqual(['android-phone'])

  await page.keyboard.press('Meta+K')
  const palette = page.getByRole('dialog', { name: 'Palette de commandes' })
  await expect(palette.getByText('Publier chez Apple…', { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')

  const screenLimit = await page.evaluate(() => {
    const projectStore = window.__sfStores?.useProjectStore
    while ((projectStore?.getState().project?.screens.length ?? 0) < 8) {
      projectStore?.getState().addScreen()
    }
    const store = projectStore?.getState()
    return {
      count: store?.project?.screens.length,
      overflow: store?.addScreen(),
    }
  })
  expect(screenLimit).toEqual({ count: 8, overflow: null })

  await expect
    .poll(() => page.evaluate(() => window.__sfStores?.useUIStore.getState().saveStatus))
    .toBe('saved')
  await page.reload({ waitUntil: 'networkidle' })
  await waitForApp(page)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__sfStores?.useProjectStore.getState().project
        return { name: project?.name, target: project?.target, screens: project?.screens.length }
      }),
    )
    .toEqual({ name: 'Campagne Android', target: 'google-play-phone', screens: 8 })
})

test('returns focus when the new-project setup is cancelled with Escape', async ({ page }) => {
  await waitForApp(page)
  const projectTrigger = page.getByRole('button', { name: 'Ouvrir le sélecteur de projets' })
  await projectTrigger.click()
  await page.getByRole('button', { name: 'Nouveau projet…' }).click()
  await expect(page.getByRole('textbox', { name: 'Nom du nouveau projet' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(projectTrigger).toBeFocused()
})
