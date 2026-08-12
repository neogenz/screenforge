import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTextLayer, grantEntitlements, waitForApp } from './helpers'

/**
 * Les cinq boîtes du cycle de vie, au clavier et dans une fenêtre étroite.
 *
 * Chaque phase a livré sa boîte et reporté cette vérification ; elle arrive
 * donc ici pour les cinq d'un coup. Deux choses sont mesurées, pas deux
 * opinions : on peut ouvrir, parcourir et refermer chaque boîte sans souris
 * et sans perdre le focus, et à 375px rien n'y déborde de sa case.
 *
 * Le seuil d'empilement vient de `lib/stage.ts`, jamais d'une copie — c'est la
 * même leçon que la pellicule restée à 142.
 */

import { DIALOG_STACK_MIN_WIDTH } from '../src/lib/stage'

/** Libellé du bouton d'ouverture, puis nom accessible de la boîte. */
const DIALOGS = [
  ['Actualiser les captures', 'Actualiser les captures'],
  ['Ouvrir les releases', 'Releases'],
  ['Générer les visuels App Store', 'Générer les visuels App Store'],
  ['Ouvrir les langues', 'Langues'],
  ['Publier chez Apple', 'Publier chez Apple'],
  ['Ouvrir l’export', 'Export officiel'],
] as const

function activeInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const active = document.activeElement
    return Boolean(active && active.closest('[role="dialog"]'))
  })
}

async function openWithKeyboard(page: Page, opener: Locator, title: string): Promise<Locator> {
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  return dialog
}

async function expectRingToken(page: Page, control: Locator): Promise<void> {
  await expect(control).toHaveClass(/focus-visible:ring-ring/)
  await control.evaluate((element) => {
    const sentinel = document.createElement('button')
    sentinel.type = 'button'
    sentinel.dataset.focusSentinel = ''
    sentinel.className = 'sr-only'
    element.before(sentinel)
    sentinel.focus()
  })
  await page.keyboard.press('Tab')
  await expect(control).toBeFocused()
  await expect
    .poll(() => control.evaluate((element) => element.matches(':focus-visible')))
    .toBe(true)
  await control.evaluate((element) =>
    element.parentElement?.querySelector('[data-focus-sentinel]')?.remove(),
  )
}

test('chaque boîte s’ouvre, se parcourt et se referme au clavier', async ({ page }) => {
  await waitForApp(page)
  await page.setViewportSize({ width: 1440, height: 900 })

  for (const [label, title] of DIALOGS) {
    const opener = page.getByLabel(label)
    const dialog = await openWithKeyboard(page, opener, title)

    // Le focus entre dans la boîte, il ne reste pas sur la page en dessous.
    expect(await activeInsideDialog(page), `${title} : focus resté dehors`).toBe(true)

    /* Le piège tient sur un tour complet. Vingt-cinq tabulations dépassent le
       nombre de contrôles de la plus fournie, donc au moins un bouclage est
       exercé : c'est là qu'un piège cassé laisse filer le focus vers la barre
       d'adresse ou vers la barre supérieure. */
    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press('Tab')
      expect(await activeInsideDialog(page), `${title} : focus échappé au tour ${step}`).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // Et il revient d'où il venait, pas au début du document.
    await expect(opener).toBeFocused()
  }
})

test('les contrôles composites des dialogues partagent le focus citron', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)
  await grantEntitlements(page, { licence: true })

  await page.getByLabel('Générer les visuels App Store').click()
  let dialog = page.getByRole('dialog', { name: 'Générer les visuels App Store' })
  await expectRingToken(page, dialog.getByRole('radio', { name: 'Contrasté' }))
  const assistance = dialog.getByRole('button', { name: /Qui écrit les accroches/ })
  await expectRingToken(page, assistance)
  await assistance.click()
  await expectRingToken(page, dialog.getByRole('radio', { name: /ScreenForge seul/ }))
  await page.keyboard.press('Escape')

  await page.getByLabel('Ouvrir les langues').click()
  dialog = page.getByRole('dialog', { name: 'Langues' })
  await dialog.getByLabel('Code').fill('de')
  await dialog.getByLabel('Nom').fill('Allemand')
  await dialog.getByRole('button', { name: 'Ajouter' }).click()
  await expectRingToken(page, dialog.getByRole('radio', { name: /de Allemand/ }))
  await expectRingToken(page, dialog.getByRole('checkbox', { name: /comme relue/ }).last())
  await page.keyboard.press('Escape')

  await page.getByLabel('Ouvrir les releases').click()
  dialog = page.getByRole('dialog', { name: 'Releases' })
  await dialog.getByLabel('Nom du lot').fill('1.0.0')
  await dialog.getByRole('button', { name: 'Figer une release' }).click()
  await expect(page.getByText(/Release « 1.0.0 » figée/)).toBeVisible({ timeout: 30_000 })
  await expectRingToken(page, dialog.locator('button[aria-current="true"]'))
  await page.keyboard.press('Escape')

  await page.getByLabel('Publier chez Apple').click()
  dialog = page.getByRole('dialog', { name: 'Publier chez Apple' })
  await expectRingToken(page, dialog.locator('button[aria-current="true"]'))
  await page.keyboard.press('Escape')

  await page.getByLabel('Ouvrir l’export').click()
  dialog = page.getByRole('dialog', { name: 'Export officiel' })
  await expectRingToken(page, dialog.getByRole('checkbox').first())
  await expect(dialog.locator('[class~="focus-visible:ring-foreground"]')).toHaveCount(0)
})

test('rien ne déborde de sa case dans une fenêtre de 375px', async ({ page }) => {
  await waitForApp(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await addTextLayer(page)
  await grantEntitlements(page, { licence: true })

  // Un lot figé : sans lui, deux des boîtes n'affichent que leur état vide, et
  // c'est justement leur colonne de contenu qui est à l'étroit.
  await page.getByLabel('Ouvrir les releases').click()
  await page.getByLabel('Nom du lot').fill('1.0.0')
  await page.getByRole('button', { name: 'Figer une release' }).click()
  await expect(page.getByText(/Release « 1.0.0 » figée/)).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Escape')

  for (const [label, title] of DIALOGS) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByLabel(label).click()
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog).toBeVisible()

    await page.setViewportSize({ width: 375, height: 720 })
    // La mise en page répond à un `matchMedia` que React traite au tick
    // suivant : mesurer dans la foulée rendrait la disposition d'avant.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const panel = document.querySelector('[role="dialog"]')
          if (!panel) return null
          const box = panel.getBoundingClientRect()
          const dehors: string[] = []
          for (const élément of panel.querySelectorAll('*')) {
            const style = getComputedStyle(élément)
            // Une ellipse et une case à défilement sont des décisions, pas des
            // débordements : elles annoncent elles-mêmes qu'elles coupent.
            if (style.textOverflow === 'ellipsis') continue
            if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue
            const rect = élément.getBoundingClientRect()
            if (rect.width === 0) continue
            if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5) {
              dehors.push(
                `${élément.tagName.toLowerCase()}.${élément.className.toString().slice(0, 40)}`,
              )
            }
          }
          return {
            dehors: dehors.slice(0, 4),
            dansLaFenêtre: box.left >= -0.5 && box.right <= window.innerWidth + 0.5,
            défilementHorizontal: document.documentElement.scrollWidth > window.innerWidth,
          }
        }),
      )
      .toEqual({ dehors: [], dansLaFenêtre: true, défilementHorizontal: false })

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  }
})

/* Les deux orientations du rail : à gauche quand il porte ce qu'on choisit,
   à droite quand il récapitule ce que la colonne principale décide. Empiler
   n'est pas la même opération dans les deux sens — les bordures changent de
   côté et l'ordre du DOM avec elles. */
const BOÎTES_À_COLONNES = [
  ['Ouvrir les releases', 'Releases'],
  ['Ouvrir l’export', 'Export officiel'],
] as const

for (const [label, title] of BOÎTES_À_COLONNES) {
  test(`« ${title} » empile ses colonnes sous le seuil`, async ({ page }) => {
    await waitForApp(page)

    /* Ouverte au large : sous `TOP_BAR_COMPACT_WIDTH` le bouton part au menu de
       débordement, et la traversée de ce menu est déjà mesurée ailleurs. Ce qui
       se joue ici est la boîte, pas la barre. */
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByLabel(label).click()
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog).toBeVisible()

    const colonnes = () =>
      page.evaluate(() => {
        const grille = document.querySelector('[role="dialog"] [data-dialog-columns]')
        return grille ? getComputedStyle(grille).gridTemplateColumns.split(' ').length : -1
      })

    await page.setViewportSize({ width: DIALOG_STACK_MIN_WIDTH + 80, height: 800 })
    await expect.poll(colonnes).toBe(2)

    /* Sous le seuil, elles s'empilent. À 375px la boîte fait 343 : deux colonnes
       y laissaient 103px au formulaire, assez pour un champ mais pas pour lire sa
       valeur — la boîte ne débordait pas, elle devenait illisible en silence. */
    await page.setViewportSize({ width: DIALOG_STACK_MIN_WIDTH - 80, height: 800 })
    await expect.poll(colonnes).toBe(1)
  })
}
