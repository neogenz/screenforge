import { expect, test } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Le chrome flottant face à une fenêtre qui rétrécit.
 *
 * Quatre défauts mesurés avant ces seuils, tous silencieux : à 560px la barre
 * débordait de 118px et « Exporter » quittait l'écran ; à 375px elle en perdait
 * six contrôles et les deux tiroirs se recouvraient de 249px ; le HUD de zoom
 * mordait sur la pellicule ; et le seuil de repli lui-même, calé sur un contenu
 * qui a grossi de six boutons depuis, remettait « Exporter » hors de l'écran de
 * 768 à 1114. Les seuils viennent de `lib/stage.ts`, jamais d'une copie — c'est
 * la leçon de la constante de pellicule restée à 142. Ce fichier mesure au
 * seuil, pas seulement de part et d'autre : un seuil vrai des deux côtés et
 * faux au milieu est exactement ce qui est passé.
 */
import { DUAL_DRAWER_MIN_WIDTH, TOP_BAR_COMPACT_WIDTH, TOP_BAR_TOOLS_WIDTH } from '../src/lib/stage'

const HEIGHT = 900

test('garde Exporter à l’écran et un seul tiroir quand la fenêtre se resserre', async ({
  page,
}) => {
  await waitForApp(page)

  // Large : la rangée complète, les deux tiroirs.
  await page.setViewportSize({ width: 1440, height: HEIGHT })
  await expect(page.getByLabel('Ouvrir les modèles')).toBeVisible()
  await expect(page.getByLabel('Ouvrir les autres actions')).toHaveCount(0)

  /* Au seuil exact : la largeur la plus étroite où la rangée est encore
     déployée, donc le seul endroit où un seuil calé sur un contenu périmé se
     voit. Personne ne mesurait ici, et la rangée y a débordé de 119px pendant
     tout le cycle de vie — « Ouvrir l'export » posé à 1006 dans une fenêtre de
     900, sans défilement pour aller le chercher. */
  await page.setViewportSize({ width: TOP_BAR_COMPACT_WIDTH, height: HEIGHT })
  await expect(page.getByLabel('Ouvrir les modèles')).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const rangée = document.querySelector('header')?.firstElementChild
        const exporter = document.querySelector('[aria-label="Ouvrir l’export"]')
        if (!rangée || !exporter) return null
        return {
          débordement: Math.max(0, rangée.scrollWidth - rangée.clientWidth),
          horsFenêtre: Math.max(
            0,
            Math.round(exporter.getBoundingClientRect().right - window.innerWidth),
          ),
        }
      }),
    )
    .toEqual({ débordement: 0, horsFenêtre: 0 })

  // Sous le seuil des deux tiroirs : il n'en reste qu'un, et c'est celui
  // qui édite.
  await page.setViewportSize({ width: DUAL_DRAWER_MIN_WIDTH - 40, height: HEIGHT })
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        layers: window.__sfStores?.useUIStore.getState().layersOpen,
        props: window.__sfStores?.useUIStore.getState().propsOpen,
      })),
    )
    .toEqual({ layers: false, props: true })

  // Sous le seuil de la barre : les actions secondaires passent au menu, le
  // CTA principal reste sur la rangée et dans le viewport.
  await page.setViewportSize({ width: TOP_BAR_COMPACT_WIDTH - 40, height: HEIGHT })
  await expect(page.getByLabel('Ouvrir les autres actions')).toBeVisible()
  await expect(page.getByLabel('Ouvrir les modèles')).toHaveCount(0)

  const exportButton = page.getByLabel('Ouvrir l’export')
  await expect(exportButton).toBeVisible()
  const box = await exportButton.boundingBox()
  expect(box, 'le bouton Exporter n’a pas de boîte').not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual(TOP_BAR_COMPACT_WIDTH - 40)

  // Les actions repliées restent atteignables, pas seulement présentes.
  await page.getByLabel('Ouvrir les autres actions').click()
  await expect(page.getByRole('menuitem', { name: 'Changer de thème' })).toBeVisible()
  await page.keyboard.press('Escape')

  /* Et au seuil du palier suivant : la largeur la plus étroite où les outils de
     création sont encore sur la rangée. Chaque palier a un point le plus serré,
     et c'est le seul qui prouve quoi que ce soit — mesurer 40px sous un seuil ne
     dit rien du bas de la bande qu'il ouvre. */
  await page.setViewportSize({ width: TOP_BAR_TOOLS_WIDTH, height: HEIGHT })
  await expect(page.getByLabel('Ajouter Texte')).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const rangée = document.querySelector('header')?.firstElementChild
        const exporter = document.querySelector('[aria-label="Ouvrir l’export"]')
        if (!rangée || !exporter) return null
        return {
          débordement: Math.max(0, rangée.scrollWidth - rangée.clientWidth),
          horsFenêtre: Math.max(
            0,
            Math.round(exporter.getBoundingClientRect().right - window.innerWidth),
          ),
        }
      }),
    )
    .toEqual({ débordement: 0, horsFenêtre: 0 })
})

test('tient dans une fenêtre étroite au lieu de refuser de rendre', async ({ page }) => {
  await waitForApp(page)

  // 375px : la largeur d'un iPhone, bien sous tout ce que l'éditeur vise. Il
  // rend au mieux — ce qu'il ne peut pas faire, c'est pousser ses commandes
  // hors de la fenêtre sans le dire.
  await page.setViewportSize({ width: 375, height: HEIGHT })
  await expect(page.getByLabel('Ouvrir l’export')).toBeVisible()

  const debordements = await page.evaluate(() => {
    const dehors: string[] = []
    const largeur = window.innerWidth
    for (const [nom, sélecteur] of [
      ['Exporter', '[aria-label="Ouvrir l’export"]'],
      ['barre supérieure', 'header'],
      ['pellicule', '[role="group"][aria-label="Écrans"]'],
      ['HUD de zoom', '[aria-label="Ajuster le zoom aux écrans"]'],
      ['tiroir', 'aside'],
    ] as const) {
      for (const élément of document.querySelectorAll(sélecteur)) {
        if (élément.closest('[aria-hidden="true"]')) continue
        const boîte = élément.getBoundingClientRect()
        if (boîte.width === 0) continue
        if (boîte.left < -0.5 || boîte.right > largeur + 0.5) {
          dehors.push(
            `${nom} : ${Math.round(boîte.left)}…${Math.round(boîte.right)} pour ${largeur}`,
          )
        }
      }
    }
    const bande = document
      .querySelector('[role="group"][aria-label="Écrans"]')
      ?.getBoundingClientRect()
    const hud = document
      .querySelector('[aria-label="Ajuster le zoom aux écrans"]')
      ?.closest('div')
      ?.getBoundingClientRect()
    return {
      dehors,
      défilementHorizontal: document.documentElement.scrollWidth > largeur,
      chevauchement: bande && hud ? Math.max(0, Math.round(bande.right - hud.left)) : -1,
    }
  })
  expect(debordements.dehors).toEqual([])
  expect(debordements.défilementHorizontal).toBe(false)
  expect(debordements.chevauchement, 'le HUD reprend le clic des vignettes').toBe(0)

  // Et le canevas rend toujours ses planches, il ne se replie pas en carte.
  expect(
    await page.evaluate(() =>
      window.__sfCanvas
        ?.getObjects()
        .some(
          (object) =>
            (object as { data?: { rendererType?: string } }).data?.rendererType === 'background',
        ),
    ),
  ).toBe(true)
})

test('garde la pellicule cliquable quand elle touche son plancher', async ({ page }) => {
  await waitForApp(page)

  // 320px : la bande est à sa largeur minimale, donc elle ne peut plus céder
  // à la gouttière du HUD. Centrée, elle mordait dessus de 27px — et c'est le
  // HUD qui recevait le clic destiné à la vignette.
  await page.setViewportSize({ width: 320, height: HEIGHT })
  /* Mesuré en boucle, pas une fois : le décentrage passe par un
     `matchMedia` que React traite au tick suivant, et lire la géométrie dans
     la foulée du redimensionnement rendait la mise en page d'avant — 27px de
     chevauchement, soit exactement l'ancien défaut, sur une bande qui l'avait
     déjà corrigé. */
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const bande = document
          .querySelector('[role="group"][aria-label="Écrans"]')
          ?.getBoundingClientRect()
        const hud = document
          .querySelector('[aria-label="Ajuster le zoom aux écrans"]')
          ?.closest('div')
          ?.getBoundingClientRect()
        if (!bande || !hud) return null
        return {
          chevauchement: Math.max(0, Math.round(bande.right - hud.left)),
          bandeVisible: bande.left >= -0.5 && bande.width > 0,
        }
      }),
    )
    .toEqual({ chevauchement: 0, bandeVisible: true })

  // La dernière vignette reçoit bien son clic, pas le HUD.
  const tuile = page.locator('button[aria-label^="Activer"]').last()
  await tuile.click()
  await expect(tuile).toHaveAttribute('aria-pressed', 'true')
})
