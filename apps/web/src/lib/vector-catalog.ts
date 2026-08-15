/**
 * Le registre des vecteurs : un identifiant stable, un tracé, rien d'autre.
 *
 * Un projet ne persiste jamais de SVG — il persiste un identifiant de ce
 * catalogue. C'est ce qui rend sûr le jour où un modèle de langage pose des
 * calques : il choisit dans une liste fermée au lieu d'écrire du balisage que
 * personne n'a relu, et un identifiant inconnu est refusé à la validation
 * plutôt que rendu.
 *
 * Les identifiants eux-mêmes vivent dans le contrat partagé
 * (`@screenforge/project-format`, module `catalog-ids`) : la validation du
 * projet et les schémas d'outils IA en ont besoin sans les tracés. Ici ne
 * reste que ce qui sert au rendu — libellés, groupes, tracés, boîtes
 * dessinées — adossé à ces identifiants.
 *
 * Les formes sont tracées dans une boîte de 100 × 100 : l'objet Fabric est mis
 * à l'échelle, jamais retracé, donc redimensionner ne reconstruit rien. Les
 * icônes gardent la boîte de 24 de leur source et se dessinent au trait.
 *
 * Elles n'en occupent pas toutes la totalité, et `drawn` dit laquelle occupe
 * quoi. Fabric met un tracé à l'échelle de **sa propre** boîte englobante, pas
 * de celle du catalogue : « Ligne » est un bandeau de 100 × 12, donc un calque
 * de 88 × 40 le rend en pavé plein, quand un `viewBox` de 100 le rendait en
 * filet de cinq pixels. Le champ existe pour que l'aperçu de campagne — qui
 * dessine ces formes en SVG et non par Fabric — les mette à l'échelle de la
 * même manière. Il est mesuré par un vrai moteur SVG dans `vector-catalog.spec`,
 * jamais recopié à la main.
 */
import {
  ICON_BOX,
  ICON_STROKE,
  SHAPE_BOX,
  isIconId,
  isShapeId,
  type IconId,
  type ShapeId,
} from '@screenforge/project-format/catalog-ids'

export { ICON_BOX, ICON_STROKE, SHAPE_BOX, isIconId, isShapeId }
export type { IconId, ShapeId }

const SHAPES = [
  { id: 'rectangle', label: 'Rectangle', group: 'Base' },
  { id: 'rounded-rect', label: 'Arrondi', group: 'Base' },
  { id: 'circle', label: 'Cercle', group: 'Base' },
  { id: 'line', label: 'Ligne', group: 'Base', path: 'M0 44h100v12H0z', drawn: [0, 44, 100, 12] },
  {
    id: 'triangle',
    label: 'Triangle',
    group: 'Géométrie',
    path: 'M50 2 98 96H2z',
    drawn: [2, 2, 96, 94],
  },
  {
    id: 'diamond',
    label: 'Losange',
    group: 'Géométrie',
    path: 'M50 1 99 50 50 99 1 50z',
    drawn: [1, 1, 98, 98],
  },
  {
    id: 'arch',
    label: 'Arche',
    group: 'Géométrie',
    path: 'M4 98V48a46 46 0 0 1 92 0v50z',
    drawn: [4, 2, 92, 96],
  },
  {
    id: 'ring',
    label: 'Anneau',
    group: 'Géométrie',
    path: 'M50 0a50 50 0 1 1 0 100a50 50 0 1 1 0-100zM50 26a24 24 0 1 0 0 48a24 24 0 1 0 0-48z',
  },
  {
    id: 'star',
    label: 'Étoile',
    group: 'Accent',
    path: 'M50 1 61.76 33.82 96.6 34.86 69.02 56.18 78.8 89.64 50 70 21.2 89.64 30.98 56.18 3.4 34.86 38.24 33.82z',
    drawn: [3.4, 1, 93.2, 88.64],
  },
  {
    id: 'burst',
    label: 'Éclat',
    group: 'Accent',
    path: 'M50 1 58.8 17.16 74.5 7.56 74.04 25.96 92.44 25.5 82.84 41.2 99 50 82.84 58.8 92.44 74.5 74.04 74.04 74.5 92.44 58.8 82.84 50 99 41.2 82.84 25.5 92.44 25.96 74.04 7.56 74.5 17.16 58.8 1 50 17.16 41.2 7.56 25.5 25.96 25.96 25.5 7.56 41.2 17.16z',
    drawn: [1, 1, 98, 98],
  },
  {
    id: 'spark',
    label: 'Étincelle',
    group: 'Accent',
    path: 'M50 0C54 38 62 46 100 50 62 54 54 62 50 100 46 62 38 54 0 50 38 46 46 38 50 0z',
  },
  {
    id: 'blob',
    label: 'Goutte',
    group: 'Accent',
    path: 'M50 1C59.55 0.88 71.16 12.84 78.99 21.01C86.82 29.18 97.35 40.69 97 50C96.65 59.31 84.7 68.87 76.87 76.87C69.04 84.87 59.43 97.53 50 98C40.57 98.47 27.97 87.7 20.3 79.7C12.63 71.7 3.76 59.66 4 50C4.24 40.34 14.05 29.88 21.72 21.72C29.38 13.55 40.45 1.12 50 1z',
    drawn: [4, 1, 93.01, 97.02],
  },
  {
    id: 'arrow',
    label: 'Flèche',
    group: 'Direction',
    path: 'M0 32h58V10l42 40-42 40V68H0z',
    drawn: [0, 10, 100, 80],
  },
  {
    id: 'wave',
    label: 'Vague',
    group: 'Direction',
    path: 'M0 58c17-34 33 34 50 0s33-34 50 0v42H0z',
    drawn: [0, 32.5, 100, 67.5],
  },
] as const

export interface ShapeEntry {
  readonly id: ShapeId
  readonly label: string
  readonly group: string
  /** Absent pour les primitives Fabric — un rectangle n'a pas besoin d'un tracé. */
  readonly path?: string
  /**
   * `[x, y, largeur, hauteur]` réellement occupés dans la boîte de 100.
   *
   * Absent quand le tracé la remplit exactement, ce qui est le cas courant.
   * Mesuré par `getBBox`, jamais estimé : les valeurs viennent de
   * `vector-catalog.spec`, qui échoue si l'une d'elles ment.
   */
  readonly drawn?: readonly [number, number, number, number]
}

/** La boîte qu'un tracé occupe : la sienne, ou celle du catalogue entière. */
export function drawnBox(entry: ShapeEntry): readonly [number, number, number, number] {
  return entry.drawn ?? [0, 0, SHAPE_BOX, SHAPE_BOX]
}

export const SHAPE_CATALOG: readonly ShapeEntry[] = SHAPES

/**
 * Les icônes viennent de Lucide (ISC), déjà installé pour l'interface.
 *
 * Les tracés sont recopiés ici plutôt qu'importés du paquet : le modèle
 * sérialisé ne doit dépendre d'aucun composant React, et le rendu Fabric a
 * besoin du `d`, pas d'un élément. Les sous-tracés d'une même icône sont
 * concaténés ; un sous-tracé relatif est précédé de `M0 0` pour retrouver
 * l'origine que lui donnait son élément d'origine.
 *
 * Version, licence et attribution : voir THIRD-PARTY-NOTICES.md.
 */
const ICONS = [
  { id: 'check', label: 'Coche', group: 'Validation', path: 'M20 6 9 17l-5-5' },
  {
    id: 'circle-check-big',
    label: 'Validé',
    group: 'Validation',
    path: 'M21.801 10A10 10 0 1 1 17 3.335 M0 0m9 11 3 3L22 4',
  },
  {
    id: 'shield-check',
    label: 'Sécurisé',
    group: 'Validation',
    path: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z M0 0m9 12 2 2 4-4',
  },
  {
    id: 'lock',
    label: 'Verrouillé',
    group: 'Validation',
    path: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2z M7 11V7a5 5 0 0 1 10 0v4',
  },
  {
    id: 'key',
    label: 'Clé',
    group: 'Validation',
    path: 'M0 0m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4 M0 0m21 2-9.6 9.6 M2 15.5a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0',
  },
  {
    id: 'star',
    label: 'Étoile',
    group: 'Mise en avant',
    path: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
  },
  {
    id: 'heart',
    label: 'Cœur',
    group: 'Mise en avant',
    path: 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5',
  },
  {
    id: 'thumbs-up',
    label: 'Pouce levé',
    group: 'Mise en avant',
    path: 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z M7 10v12',
  },
  {
    id: 'sparkles',
    label: 'Étincelles',
    group: 'Mise en avant',
    path: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z M20 2v4 M22 4h-4 M2 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  },
  {
    id: 'flame',
    label: 'Flamme',
    group: 'Mise en avant',
    path: 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4',
  },
  {
    id: 'crown',
    label: 'Couronne',
    group: 'Mise en avant',
    path: 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z M5 21h14',
  },
  {
    id: 'award',
    label: 'Récompense',
    group: 'Mise en avant',
    path: 'M0 0m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526 M6 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0',
  },
  {
    id: 'zap',
    label: 'Éclair',
    group: 'Mise en avant',
    path: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
  },
  {
    id: 'trending-up',
    label: 'Courbe',
    group: 'Données',
    path: 'M16 7h6v6 M0 0m22 7-8.5 8.5-5-5L2 17',
  },
  {
    id: 'chart-column',
    label: 'Histogramme',
    group: 'Données',
    path: 'M3 3v16a2 2 0 0 0 2 2h16 M18 17V9 M13 17V5 M8 17v-3',
  },
  {
    id: 'activity',
    label: 'Activité',
    group: 'Données',
    path: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2',
  },
  {
    id: 'target',
    label: 'Cible',
    group: 'Données',
    path: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M6 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  },
  {
    id: 'search',
    label: 'Recherche',
    group: 'Interface',
    path: 'M0 0m21 21-4.34-4.34 M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
  },
  {
    id: 'settings',
    label: 'Réglages',
    group: 'Interface',
    path: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915 M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  },
  {
    id: 'bell',
    label: 'Notification',
    group: 'Interface',
    path: 'M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  },
  {
    id: 'camera',
    label: 'Appareil photo',
    group: 'Interface',
    path: 'M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z M9 13a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  },
  {
    id: 'play',
    label: 'Lecture',
    group: 'Interface',
    path: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z',
  },
  {
    id: 'download',
    label: 'Téléchargement',
    group: 'Interface',
    path: 'M12 15V3 M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M0 0m7 10 5 5 5-5',
  },
  {
    id: 'send',
    label: 'Envoi',
    group: 'Interface',
    path: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z M0 0m21.854 2.147-10.94 10.939',
  },
  {
    id: 'calendar',
    label: 'Calendrier',
    group: 'Quotidien',
    path: 'M8 2v4 M16 2v4 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z M3 10h18',
  },
  {
    id: 'clock',
    label: 'Horloge',
    group: 'Quotidien',
    path: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 6v6l4 2',
  },
  {
    id: 'wallet',
    label: 'Portefeuille',
    group: 'Quotidien',
    path: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1 M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
  },
  {
    id: 'credit-card',
    label: 'Carte',
    group: 'Quotidien',
    path: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z M2 10L22 10',
  },
  {
    id: 'gift',
    label: 'Cadeau',
    group: 'Quotidien',
    path: 'M12 7v14 M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8 M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5 M4 7h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z',
  },
  {
    id: 'users',
    label: 'Utilisateurs',
    group: 'Quotidien',
    path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3.128a4 4 0 0 1 0 7.744 M22 21v-2a4 4 0 0 0-3-3.87 M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
  },
  {
    id: 'map-pin',
    label: 'Localisation',
    group: 'Quotidien',
    path: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0 M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  },
  {
    id: 'globe',
    label: 'Globe',
    group: 'Quotidien',
    path: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20 M2 12h20',
  },
  {
    id: 'cloud',
    label: 'Nuage',
    group: 'Quotidien',
    path: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
  },
  {
    id: 'rocket',
    label: 'Fusée',
    group: 'Quotidien',
    path: 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5 M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09 M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05',
  },
  {
    id: 'lightbulb',
    label: 'Idée',
    group: 'Quotidien',
    path: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5 M9 18h6 M10 22h4',
  },
  {
    id: 'message-circle',
    label: 'Message',
    group: 'Quotidien',
    path: 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
  },
] as const

export interface IconEntry {
  readonly id: IconId
  readonly label: string
  readonly group: string
  readonly path: string
}

export const ICON_CATALOG: readonly IconEntry[] = ICONS

export const DEFAULT_ICON_ID: IconId = 'star'

const SHAPE_BY_ID = new Map(SHAPE_CATALOG.map((entry) => [entry.id as string, entry]))
const ICON_BY_ID = new Map(ICON_CATALOG.map((entry) => [entry.id as string, entry]))

export function shapeEntry(id: string): ShapeEntry | undefined {
  return SHAPE_BY_ID.get(id)
}

export function iconEntry(id: string): IconEntry | undefined {
  return ICON_BY_ID.get(id)
}

/* Le catalogue doit couvrir exactement les identifiants du contrat partagé :
   un identifiant en trop casse ici à la compilation (`ShapeEntry.id`), un
   identifiant manquant est relevé par `__tests__/vector-catalog.test.ts`,
   qui compare les listes une à une. */

/** Groupes dans l'ordre du catalogue, pour un sélecteur qui ne les réordonne pas. */
export function groupsOf<T extends { group: string }>(entries: readonly T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const entry of entries) {
    const bucket = groups.get(entry.group)
    if (bucket) bucket.push(entry)
    else groups.set(entry.group, [entry])
  }
  return [...groups]
}
