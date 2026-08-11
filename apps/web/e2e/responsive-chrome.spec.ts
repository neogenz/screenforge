import { type Page, expect, test } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Le chrome flottant face à une fenêtre qui rétrécit.
 *
 * Cinq défauts mesurés avant ces seuils, tous silencieux : à 560px la barre
 * débordait de 118px et « Exporter » quittait l'écran ; à 375px elle en perdait
 * six contrôles et les deux tiroirs se recouvraient de 249px ; le HUD de zoom
 * mordait sur la pellicule ; le seuil de repli lui-même, calé sur un contenu
 * qui a grossi de six boutons depuis, remettait « Exporter » hors de l'écran de
 * 768 à 1114 ; et corriger ce seuil l'a posé sur le palier `xl` de Tailwind, où
 * deux libellés d'état sortaient de `sr-only` et se peignaient sur les outils.
 * Les seuils viennent de `lib/stage.ts`, jamais d'une copie — c'est la leçon de
 * la constante de pellicule restée à 142. Ce fichier mesure au seuil, pas
 * seulement de part et d'autre : un seuil vrai des deux côtés et faux au milieu
 * est exactement ce qui est passé.
 */
import {
  DUAL_DRAWER_MIN_WIDTH,
  TOP_BAR_COMPACT_WIDTH,
  TOP_BAR_LABELS_MIN_WIDTH,
  TOP_BAR_TOOLS_WIDTH,
} from '../src/lib/stage'

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

/*
 * Une largeur ne se mesure pas sans son état.
 *
 * Les deux témoins d'état vivaient sur `xl:not-sr-only`, un palier Tailwind
 * écrit en dur qui valait 1280 — donc exactement le seuil de repli. La largeur
 * la plus chargée de la rangée et celle où deux libellés apparaissent étaient
 * la même, par coïncidence. Portant `shrink-0` dans une colonne
 * `minmax(0,1fr)`, ils débordaient au lieu de céder : 126px mesurés peints sur
 * les outils pour « Modifications non enregistrées · Hors ligne », et le clic
 * de la bascule Calques pris par du texte.
 *
 * La suite ne le voyait pas parce qu'elle mesurait la largeur en laissant
 * l'état par défaut — `idle` sans cloud, la seule combinaison qui n'affiche
 * qu'un témoin sur deux.
 */
const ÉTATS_LES_PLUS_LARGES = [
  ['idle', 'offline'],
  ['error', 'error'],
  ['saving', 'syncing'],
] as const

/** Ce que la rangée laisse voir, et ce qu'elle laisse se recouvrir. */
async function rangée(page: Page) {
  return page.evaluate(() => {
    const rangée = document.querySelector('header')?.firstElementChild
    const outils = rangée?.children[1]
    const identité = rangée?.children[0]
    if (!rangée || !outils || !identité) return null
    const témoins = [...identité.querySelectorAll('[role="status"]')]
    const bordDroitDuTexte = témoins.reduce(
      (max, témoin) => Math.max(max, témoin.getBoundingClientRect().right),
      0,
    )
    return {
      /* Sans les deux témoins la mesure ne mesure rien : un `reduce` sur une
         liste vide rend 0, et un recouvrement nul par absence se lit
         exactement comme un recouvrement nul par correction. */
      témoins: témoins.length,
      /* `sr-only` garde le texte dans le DOM — c'est voulu, la région live doit
         pouvoir l'annoncer — donc « écrit » se lit sur la géométrie, pas sur le
         contenu : un libellé replié est réduit au carré d'un pixel. */
      libellésÉcrits: témoins.filter((témoin) => {
        const libellé = témoin.lastElementChild
        return libellé ? libellé.getBoundingClientRect().width > 4 : false
      }).length,
      débordement: Math.max(0, rangée.scrollWidth - rangée.clientWidth),
      recouvrement: Math.max(0, Math.round(bordDroitDuTexte - outils.getBoundingClientRect().left)),
    }
  })
}

for (const [saveStatus, syncStatus] of ÉTATS_LES_PLUS_LARGES) {
  test(`« ${saveStatus} · ${syncStatus} » ne recouvre les outils à aucun des deux seuils`, async ({
    page,
  }) => {
    await waitForApp(page)
    const poser = () =>
      page.evaluate(
        (état) => {
          window.__sfStores?.useUIStore.setState(état)
        },
        { saveStatus, syncStatus },
      )

    // Au seuil de repli : la rangée est déployée et pleine, les libellés sont
    // repliés parce qu'il n'y a pas la place de les écrire.
    await page.setViewportSize({ width: TOP_BAR_COMPACT_WIDTH, height: HEIGHT })
    await poser()
    await expect
      .poll(() => rangée(page))
      .toEqual({ témoins: 2, libellésÉcrits: 0, débordement: 0, recouvrement: 0 })

    // Au seuil des libellés : ils s'écrivent, et il y a de la place pour ça.
    await page.setViewportSize({ width: TOP_BAR_LABELS_MIN_WIDTH, height: HEIGHT })
    await poser()
    await expect
      .poll(() => rangée(page))
      .toEqual({ témoins: 2, libellésÉcrits: 2, débordement: 0, recouvrement: 0 })

    /* Et la bascule Calques reçoit son propre clic, pas le texte peint dessus.
       C'est la vraie conséquence du recouvrement, et le défaut nommé dans le
       commentaire de la grille : « cliquer dessus insérait un calque ». */
    await page.setViewportSize({ width: TOP_BAR_COMPACT_WIDTH, height: HEIGHT })
    await poser()
    const calques = page.getByLabel('Basculer le panneau Calques')
    const avant = await calques.getAttribute('aria-pressed')
    await calques.click()
    await expect(calques).toHaveAttribute('aria-pressed', avant === 'true' ? 'false' : 'true')
  })
}

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
