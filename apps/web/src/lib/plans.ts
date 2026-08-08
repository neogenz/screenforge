import type { Entitlements } from '@/lib/api'

/**
 * L'offre, dite une fois.
 *
 * Les mêmes trois paliers que la page d'accueil, mais ce n'est pas une copie
 * qu'on aurait oubliée de synchroniser : la landing vend à qui n'a pas de
 * compte, en deux langues, avec un bouton qui n'encaisse pas. Ici l'éditeur
 * s'adresse à quelqu'un de connecté, en français, et le bouton ouvre un
 * checkout. Ce qui doit rester identique, c'est le prix et la règle — et le
 * prix est un littéral des deux côtés parce qu'il est fixé chez Polar, pas ici.
 */
export type SellableProduct = 'licence' | 'cloud'

export interface Plan {
  id: SellableProduct | 'free'
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
    id: 'free',
    name: 'Gratuit',
    price: '0 $',
    period: '',
    tagline: 'Pour juger l’éditeur avant de dépenser un centime',
    points: [
      'L’éditeur complet, tous les cadres et polices',
      '3 exports par projet, filigranés',
      'Sans compte, rien à installer',
    ],
  },
  {
    id: 'licence',
    name: 'Licence',
    price: '49 $',
    period: 'une fois',
    tagline: 'Tout l’éditeur, à vous, mises à jour incluses',
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
    price: '+39 $',
    period: '/an',
    tagline: 'Complément à la Licence : vos projets sur chaque machine',
    points: [
      'Tout ce que donne la Licence',
      'Reprendre un projet sur une autre machine',
      'Historique 30 jours, hors du navigateur',
    ],
  },
]

/**
 * Le nom du palier détenu.
 *
 * Le Cloud écrase la Licence dans le libellé parce qu'il la contient : les deux
 * droits sont indépendants en base, mais un compte qui a les deux n'a qu'un
 * palier à lire.
 */
export function planName(entitlements: Entitlements | null): string {
  if (entitlements?.cloud) return 'Cloud'
  if (entitlements?.licence) return 'Licence'
  return 'Gratuit'
}
