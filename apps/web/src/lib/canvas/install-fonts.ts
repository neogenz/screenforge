import { Textbox, type Canvas } from 'fabric'
import { rewrapTextbox, type RenderedObject } from '@/lib/canvas/canvas-utils'
import { onFontMetricsChanged } from '@/lib/fonts'
import type { Project, Screen } from '@/types'

export interface FontsInstall {
  currentCanvas: () => Canvas | null
  getProject: () => Project | null
  generateThumbnails: (screens: Screen[]) => void
}

/**
 * Une police qui arrive invalide la mesure de **tous** les textes de la scène.
 *
 * `loadGoogleFont` purge le cache de largeurs de Fabric pour la famille
 * entière, toutes graisses confondues, et une seule requête part par couple
 * famille+graisse : les calques suivants qui partagent la police n'ont aucun
 * rappel à eux. Ne réenrouler que le demandeur laissait les autres avec les
 * retours à la ligne mesurés sur la police de secours et les glyphes dessinés
 * dans la vraie — Fabric peint la ligne d'un `fillText`, donc elle sortait de sa
 * boîte au lieu de se recouper. Constaté à l'ouverture d'un projet importé dans
 * un navigateur neuf : premier écran juste, les cinq suivants débordant sur la
 * planche voisine, sans qu'aucun calque n'ait bougé dans le projet.
 *
 * Toutes les boîtes et pas seulement celles de la famille chargée : la clé du
 * cache de Fabric est la famille en minuscules, l'étiquette de planche déclare
 * une pile (`Inter, system-ui, sans-serif`), et une comparaison de chaînes se
 * tromperait avant d'économiser quoi que ce soit sur quelques dizaines d'objets.
 */
export function remeasureTextObjects(objects: RenderedObject[]): void {
  for (const object of objects) {
    if (object instanceof Textbox) rewrapTextbox(object)
  }
}

/**
 * Rebranche la scène sur l'arrivée des polices, et coupe avec le canevas.
 *
 * L'événement appartient à `fonts.ts`, la conséquence appartient ici : c'est la
 * seule façon qu'une police chargée par une autre porte — l'aperçu du sélecteur,
 * la revue de locales, un export — remesure aussi ce qui est à l'écran.
 */
/**
 * La scène est-elle concernée par cette famille ?
 *
 * Fabric purge par famille, donc une famille que personne ne porte n'invalide
 * aucune mesure ici. Sans cette question, faire défiler le sélecteur de polices
 * — qui charge la graisse 400 de chaque famille visible, une quarantaine au
 * catalogue — relançait la mesure de toute la scène une fois par ligne
 * survolée, pour des polices qu'aucun calque n'utilise.
 *
 * Elle décide seulement s'il faut réagir, jamais qui remesurer : une comparaison
 * de chaînes choisit mal ses cibles (`Inter, system-ui, sans-serif` est une pile,
 * pas une famille), mais elle répond très bien à « est-ce que quelqu'un ici
 * porte ce nom ». Au moindre doute, on remesure tout.
 */
function sceneUsesFamily(objects: RenderedObject[], family: string): boolean {
  const wanted = family.toLowerCase()
  return objects.some(
    (object) =>
      object instanceof Textbox && object.fontFamily.toLowerCase().split(',')[0].trim() === wanted,
  )
}

export function installFonts(runtime: FontsInstall): { cleanup: () => void } {
  const unsubscribe = onFontMetricsChanged((family) => {
    const canvas = runtime.currentCanvas()
    if (!canvas) return
    const objects = canvas.getObjects() as RenderedObject[]
    if (!sceneUsesFamily(objects, family)) return
    remeasureTextObjects(objects)
    canvas.requestRenderAll()
    /* La vraie graisse arrive après les vignettes : sans ce second passage la
       pellicule garderait le repli système jusqu'à la prochaine édition. */
    const project = runtime.getProject()
    if (project) runtime.generateThumbnails(project.screens)
  })
  return { cleanup: unsubscribe }
}
