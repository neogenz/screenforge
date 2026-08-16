import type { Entitlements } from '@/lib/entitlements'

/**
 * L'offre, dite une fois.
 *
 * Les mêmes deux offres que la page d'accueil, mais ce n'est pas une copie
 * qu'on aurait oubliée de synchroniser : la landing vend à qui n'a pas de
 * compte, en deux langues, avec un bouton qui n'encaisse pas. Ici l'éditeur
 * s'adresse à quelqu'un de connecté, en français, et le bouton ouvre un
 * checkout. Ce qui doit rester identique, c'est le prix et la règle — et le
 * prix est un littéral des deux côtés parce qu'il est fixé chez Polar, pas ici.
 */
export type PlanId = 'local' | 'cloud'
export type SellableProduct = 'cloud'

export interface Plan {
  id: PlanId
  name: string
  price: string
  period: string
  tagline: string
  points: string[]
  /** Ce que le palier lève, dit du point de vue de l'éditeur. */
  badge?: string
}

export const PLANS: Plan[] = [
  {
    id: 'local',
    name: 'Local',
    price: '0 $',
    period: 'pour toujours',
    tagline: 'Tout l’éditeur sur votre machine, sans compte',
    points: [
      'Exports illimités, sans filigrane',
      'ZIP groupé, un fichier par planche',
      'Projets et images conservés localement',
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud',
    price: '39 $',
    period: '/an',
    tagline: 'L’éditeur complet et vos projets sur chaque machine',
    points: [
      'Tout Local, sans limite artificielle',
      'Projets, images et thème synchronisés',
      'Reprendre un projet sur une autre machine',
    ],
  },
]

/**
 * Le nom du palier détenu.
 *
 * Le Cloud écrase Local dans le libellé parce qu'il en inclut les capacités : les deux
 * droits sont indépendants en base, mais un compte qui a les deux n'a qu'un
 * palier à lire.
 */
export function planName(entitlements: Entitlements | null): string {
  if (entitlements?.cloud) return 'Cloud'
  return 'Local'
}

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

/**
 * Une date de droit, ou `null` si elle ne dit rien.
 *
 * Deux boîtes affichent ces dates — les offres et le compte — et une date qui
 * ne se formaterait pas pareil des deux côtés ferait douter de laquelle est la
 * bonne. `null` couvre l'absence comme l'illisible : dans les deux cas il n'y a
 * pas de date à montrer, et l'appelant a déjà une phrase pour ce cas.
 */
export function formatGrantDate(iso: string | null): string | null {
  if (!iso) return null
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : DATE.format(time)
}
