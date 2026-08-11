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

/**
 * Ce qui se clique le dit au survol.
 *
 * Tailwind v4 a retiré `cursor: pointer` des boutons de sa Preflight, et rien
 * dans l'application ne s'en est aperçu : 35 contrôles rendaient la flèche
 * contre 7 le doigt. Une entrée de menu, qui n'est pas un `button`, retombait
 * sur `auto` — au-dessus de son texte, le curseur d'insertion. Le défaut est
 * silencieux par construction : aucune assertion sur le rendu ne l'attrape, et
 * il revient au premier composant qui oublie sa classe.
 *
 * Le test mesure donc le curseur calculé, sur la page et sur un menu ouvert,
 * et n'accepte que ce qui a été décidé : `pointer` pour ce qui se clique,
 * `default` pour un contrôle désactivé, et les curseurs de geste que des
 * composants posent exprès.
 */
test('ne laisse aucun élément cliquable rendre le curseur de texte', async ({ page }) => {
  await waitForApp(page)
  // Le menu Projet et non le menu de débordement : celui-ci n'existe qu'en
  // fenêtre étroite, et le test tournerait alors sans jamais ouvrir de menu.
  await page.locator('button[aria-label="Ouvrir le menu Projet"]').click()
  await expect(page.getByRole('menu')).toBeVisible()

  const wrong = await page.evaluate(() => {
    const selector = [
      'button',
      'summary',
      'select',
      '[role="button"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="tab"]',
      '[role="switch"]',
      '[role="checkbox"]',
      '[role="radio"]',
    ].join(', ')
    // Les curseurs qu'un composant pose exprès pour annoncer un geste, et non
    // un clic : la poignée d'un dégradé se tire, elle ne se presse pas.
    const gesture = new Set(['ew-resize', 'grab', 'grabbing'])
    return [...document.querySelectorAll(selector)]
      .filter((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.height > 0
      })
      .map((element) => ({
        name:
          element.getAttribute('aria-label') ||
          element.textContent?.trim().slice(0, 30) ||
          '(vide)',
        cursor: getComputedStyle(element).cursor,
        disabled: element.matches(':disabled, [aria-disabled="true"]'),
      }))
      .filter((entry) => {
        if (gesture.has(entry.cursor)) return false
        return entry.cursor !== (entry.disabled ? 'default' : 'pointer')
      })
  })

  expect(wrong).toEqual([])
})
