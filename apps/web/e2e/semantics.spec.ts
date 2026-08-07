import { expect, test } from '@playwright/test'
import { addTextLayer, waitForApp } from './helpers'

/**
 * La structure du document, pas seulement sa peinture.
 *
 * Mesuré avant : zéro élément de titre dans toute l'application. « Calques »,
 * « Propriétés », « Transformation » étaient des `span` stylés — une hiérarchie
 * entièrement visuelle, où le saut de titre d'un lecteur d'écran ne renvoyait
 * rien et où le panneau Calques n'était même pas un repère.
 */

test('expose une hiérarchie de titres et des repères nommés', async ({ page }) => {
  await waitForApp(page)

  await expect(page.getByRole('heading', { name: 'ScreenForge', level: 1 })).toBeAttached()
  await expect(page.getByRole('heading', { name: 'Calques', level: 2 })).toBeVisible()

  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Calques' })).toBeVisible()
  await expect(page.getByRole('main')).toBeAttached()

  // Une section de panneau est un titre qui porte son bouton : elle doit être
  // annoncée comme les deux, sinon on retombe sur un bouton hors hiérarchie.
  await addTextLayer(page)
  const section = page.getByRole('heading', { name: 'Transformation', level: 3 })
  await expect(section).toBeVisible()
  await expect(section.getByRole('button', { name: 'Transformation' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  // Aucun saut de niveau : c'est ce qui rend la hiérarchie parcourable.
  const levels = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
  )
  expect(levels.length).toBeGreaterThan(3)
  expect(levels.filter((level, index) => index > 0 && level - levels[index - 1] > 1)).toEqual([])
})
