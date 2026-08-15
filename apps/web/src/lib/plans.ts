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
export type SellableProduct = 'local' | 'cloud'

export interface Plan {
  id: SellableProduct
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
    price: '49 $',
    period: 'une fois',
    /* « à vous » disait l'éditeur et s'entendait comme les projets : ce que
       Local donne est le logiciel, et le travail reste sur la machine, ce que
       seule la carte Cloud disait — à qui allait la lire. */
    tagline: 'Tout l’éditeur sur votre machine, mises à jour incluses',
    points: [
      'Exports illimités, sans filigrane',
      'ZIP groupé, un fichier par planche',
      'Mises à jour à vie, rien à renouveler',
    ],
    badge: 'Recommandé',
  },
  {
    id: 'cloud',
    name: 'Cloud',
    price: '39 $',
    period: '/an',
    tagline: 'L’éditeur complet et vos projets sur chaque machine',
    points: [
      'Exports illimités et ZIP sans filigrane',
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
  if (entitlements?.licence) return 'Local'
  return 'Essai'
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
