import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  addTextLayer,
  expectOneFocusRing,
  layerRows,
  openMenu,
  openUtility,
  utilitiesTrigger,
  waitForApp,
} from './helpers'

/**
 * Les boîtes livrées par les phases, au clavier et dans une fenêtre étroite.
 *
 * Chaque phase a livré sa boîte et reporté cette vérification ; elle arrive
 * donc ici pour toutes d'un coup, et toute boîte ajoutée depuis rejoint la
 * liste plutôt que d'ouvrir sa propre vérification. Deux choses sont mesurées,
 * pas deux
 * opinions : on peut ouvrir, parcourir et refermer chaque boîte sans souris
 * et sans perdre le focus, et à 375px rien n'y déborde de sa case.
 *
 * Le seuil d'empilement vient de `lib/stage.ts`, jamais d'une copie — c'est la
 * même leçon que la pellicule restée à 142.
 */

import { DIALOG_STACK_MIN_WIDTH } from '../src/lib/stage'

/**
 * Libellé de l'entrée d'ouverture, nom accessible de la boîte, et par où on y
 * entre : la rangée, ou le menu « … » qui porte les utilitaires.
 */
const DIALOGS = [
  ['Actualiser les captures', 'Actualiser les captures', 'rangée'],
  ['Ouvrir les releases', 'Releases', 'rangée'],
  ['Générer les visuels de la fiche', 'Générer les visuels · App Store · iPhone', 'rangée'],
  ['Ouvrir les langues', 'Langues', 'rangée'],
  ['Publier chez Apple', 'Publier chez Apple', 'rangée'],
  ['Connexion MCP', 'Connexion MCP', 'menu'],
  ['Ouvrir l’export', 'Export officiel', 'rangée'],
] as const

function activeInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const active = document.activeElement
    return Boolean(active && active.closest('[role="dialog"]'))
  })
}

async function openWithKeyboard(
  page: Page,
  label: string,
  title: string,
  via: 'rangée' | 'menu',
): Promise<Locator> {
  if (via === 'menu') {
    /* L'entrée est dans le menu « … » : deux activations au clavier, et c'est
       le déclencheur du menu qui reste l'appelant, l'entrée disparaissant avec
       lui. */
    await openMenu(page, utilitiesTrigger(page), label)
  } else {
    await page.getByLabel(label).focus()
  }
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  return dialog
}

/**
 * Congédie la boîte. Une infobulle ouverte au focus est une couche au-dessus
 * de la boîte : le premier Échap la congédie elle, le second la boîte — même
 * règle qu'un Select ouvert dans une modale. La boucle absorbe la course entre
 * le délai d'apparition de l'infobulle et la première pression.
 */
async function closeDialog(page: Page, dialog: Locator): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press('Escape')
    try {
      await expect(dialog).toBeHidden({ timeout: 800 })
      return
    } catch {
      // Une couche (infobulle, menu) a pris cet Échap : le suivant ira à la boîte.
    }
  }
  await expect(dialog).toBeHidden()
}

test('chaque boîte s’ouvre, se parcourt et se referme au clavier', async ({ page }) => {
  await waitForApp(page)
  await page.setViewportSize({ width: 1440, height: 900 })

  for (const [label, title, via] of DIALOGS) {
    const opener = via === 'menu' ? utilitiesTrigger(page) : page.getByLabel(label)
    const dialog = await openWithKeyboard(page, label, title, via)

    // Le focus entre dans la boîte, il ne reste pas sur la page en dessous.
    await expect
      .poll(() => activeInsideDialog(page), { message: `${title} : focus resté dehors` })
      .toBe(true)

    if (title === 'Connexion MCP') {
      await expect(dialog.locator('[data-slot="setup-step"]')).toHaveCount(4)
      await expect(
        dialog.getByRole('progressbar', { name: 'Progression de la connexion MCP' }),
      ).toBeVisible()
      const details = dialog.locator('details')
      await dialog.getByText('Détails de connexion').click()
      await expect(details).toHaveAttribute('open', '')
    }

    /* Le piège tient sur un tour complet. Vingt-cinq tabulations dépassent le
       nombre de contrôles de la plus fournie, donc au moins un bouclage est
       exercé : c'est là qu'un piège cassé laisse filer le focus vers la barre
       d'adresse ou vers la barre supérieure. */
    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press('Tab')
      // Le garde de Base UI rapatrie le focus à la frame suivante, pas dans
      // le keydown : on laisse cette frame passer avant de juger.
      await expect
        .poll(() => activeInsideDialog(page), {
          message: `${title} : focus échappé au tour ${step}`,
        })
        .toBe(true)
    }

    await closeDialog(page, dialog)
    // Et il revient d'où il venait, pas au début du document.
    await expect(opener).toBeFocused()
  }
})

test('les contrôles composites des dialogues partagent le focus citron', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)

  await page.getByLabel('Générer les visuels de la fiche').click()
  let dialog = page.getByRole('dialog', { name: 'Générer les visuels · App Store · iPhone' })
  await expectOneFocusRing(page, dialog.getByRole('radio', { name: 'Sobre' }))
  const assistance = dialog.getByRole('button', { name: /Qui écrit les accroches/ })
  await expectOneFocusRing(page, assistance)
  await assistance.click()
  // Le bouton cliqué disparaît avec la vue : Base UI rapatrie le focus dans
  // la boîte à la frame suivante, et l'attendre évite qu'il vole la sentinelle.
  await expect.poll(() => activeInsideDialog(page)).toBe(true)
  // L'étape glisse en entrant ; une sentinelle posée pendant l'animation se
  // fait doubler par le rapatriement du focus.
  await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running'))
  await expectOneFocusRing(page, dialog.getByRole('radio', { name: /ScreenForge seul/ }))
  await closeDialog(page, dialog)

  await page.getByLabel('Ouvrir les langues').click()
  dialog = page.getByRole('dialog', { name: 'Langues' })
  await dialog.getByLabel('Code').fill('de')
  await dialog.getByLabel('Nom').fill('Allemand')
  await dialog.getByRole('button', { name: 'Ajouter' }).click()
  await expectOneFocusRing(page, dialog.getByRole('radio', { name: /de Allemand/ }))
  await expectOneFocusRing(page, dialog.getByRole('checkbox', { name: /comme relue/ }).last())
  await closeDialog(page, dialog)

  await page.getByLabel('Ouvrir les releases').click()
  dialog = page.getByRole('dialog', { name: 'Releases' })
  await dialog.getByLabel('Nom de la release').fill('1.0.0')
  await dialog.getByRole('button', { name: 'Figer une release' }).click()
  await expect(page.getByText(/Release « 1.0.0 » figée/)).toBeVisible({ timeout: 30_000 })
  await expectOneFocusRing(page, dialog.locator('button[aria-current="true"]'))
  await closeDialog(page, dialog)

  await page.getByLabel('Publier chez Apple').click()
  dialog = page.getByRole('dialog', { name: 'Publier chez Apple' })
  // Un lot existe : la boîte s'ouvre sur l'envoi, le choix du lot est l'étape d'avant.
  await dialog.getByRole('button', { name: 'Retour' }).click()
  await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running'))
  await expectOneFocusRing(page, dialog.locator('button[aria-current="true"]'))
  await closeDialog(page, dialog)

  await page.getByLabel('Ouvrir l’export').click()
  dialog = page.getByRole('dialog', { name: 'Export officiel' })
  await expectOneFocusRing(page, dialog.getByRole('checkbox').first())
  await expect(dialog.locator('[class~="focus-visible:ring-foreground"]')).toHaveCount(0)
  await closeDialog(page, dialog)
})

test('rien ne déborde de sa case dans une fenêtre de 375px', async ({ page }) => {
  await waitForApp(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await addTextLayer(page)

  // Un lot figé : sans lui, deux des boîtes n'affichent que leur état vide, et
  // c'est justement leur colonne de contenu qui est à l'étroit.
  await page.getByLabel('Ouvrir les releases').click()
  await page.getByLabel('Nom de la release').fill('1.0.0')
  await page.getByRole('button', { name: 'Figer une release' }).click()
  await expect(page.getByText(/Release « 1.0.0 » figée/)).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Escape')

  for (const [label, title, via] of DIALOGS) {
    await page.setViewportSize({ width: 1440, height: 900 })
    if (via === 'menu') await openUtility(page, label)
    else await page.getByLabel(label).click()
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
            // Les champs cachés de Base UI (Select, Checkbox) sont un pixel
            // rogné à `clip-path`, posé à -1px par construction : rien à voir.
            if (élément.getAttribute('aria-hidden') === 'true' && style.clipPath !== 'none')
              continue
            const rect = élément.getBoundingClientRect()
            // Un pixel de sonde (le `span` de mesure de Progress) n'est pas
            // une mise en page qui déborde.
            if (rect.width <= 1) continue
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

    await closeDialog(page, dialog)
  }
})

test('une radio-card ne peint qu’un seul indicateur de focus', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)

  await page.getByLabel('Générer les visuels de la fiche').click()
  const dialog = page.getByRole('dialog', { name: 'Générer les visuels · App Store · iPhone' })
  const radio = dialog.getByRole('radio', { name: 'Sobre' })
  await radio.focus()
  /* L'input invisible couvre toute la carte : sans `outline-none` il peint le
     contour natif du navigateur par-dessus l'anneau 1px du label — deux
     indicateurs pour un seul état. */
  await expect
    .poll(() => radio.evaluate((element) => getComputedStyle(element).outlineStyle))
    .toBe('none')
  await closeDialog(page, dialog)
})

test('Escape dans un Select du panneau ne ferme que le Select', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)
  const propsOpen = await page.evaluate(() => window.__sfStores?.useUIStore.getState().propsOpen)
  if (!propsOpen) await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleProps())

  const select = page.getByLabel('Graisse de la police')
  await expect(select).toBeVisible()
  await select.click()
  await expect(select).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(select).toHaveAttribute('aria-expanded', 'false')
  /* Sans le stopPropagation du Select, l'événement remontait au gestionnaire
     global, qui fermait aussi le drawer sous le menu qu'il venait de fermer. */
  await expect
    .poll(() => page.evaluate(() => window.__sfStores?.useUIStore.getState().propsOpen))
    .toBe(true)
  await expect(select).toBeVisible()
})

test('un drawer fermé est inerte et démonté', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)

  const layersOpen = await page.evaluate(() => window.__sfStores?.useUIStore.getState().layersOpen)
  if (!layersOpen)
    await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())
  await expect(layerRows(page).first()).toBeVisible()

  await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())
  await expect
    .poll(() => page.evaluate(() => window.__sfStores?.useUIStore.getState().layersOpen))
    .toBe(false)

  /* Inerte tout de suite : Tab ne peut plus atteindre un contrôle d'un panneau
     traduit hors de l'écran mais encore monté. */
  const drawer = page.locator('div[aria-hidden="true"][class*="transition-ui"]').first()
  await expect(drawer).toHaveAttribute('inert', '')
  /* Démonté une fois la transition de sortie jouée : un scrub du canvas ne
     re-rend plus un panneau que personne ne voit. */
  await expect(layerRows(page)).toHaveCount(0, { timeout: 2_000 })
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
