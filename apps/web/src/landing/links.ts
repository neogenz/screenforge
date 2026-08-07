/*
 * Cibles des liens de la landing. Le checkout n'existe pas encore : il relève
 * du plan SaaS (comptes + paiement). Tant qu'il n'est pas livré, les offres
 * payantes mènent à une inscription à la liste, et les libellés des boutons le
 * disent. Au branchement, seul `notify()` change — jamais un composant, jamais
 * un libellé.
 *
 * L'objet du mail suit la langue de la page : le sujet était figé en français
 * et s'ouvrait tel quel dans le client mail d'un visiteur anglophone, au seul
 * moment de la page où il a la plus forte intention.
 */
// TODO(checkout): remplacer notify() par les liens de paiement
// — voir aidd_docs/tasks/2026_08/2026_08_06_offre-commerciale/pricing.md
import type { Lang } from './i18n'

const ADDRESS = 'mailto:hello@screenforge.app'

/* Deux-points, pas un cadratin : l'objet est du texte rendu dès que le client
   mail s'ouvre, et la page s'interdit les tirets longs partout ailleurs. */
const SUBJECTS = {
  en: { licence: 'ScreenForge Licence: notify me', cloud: 'ScreenForge Cloud: notify me' },
  fr: {
    licence: 'ScreenForge Licence : prévenez-moi',
    cloud: 'ScreenForge Cloud : prévenez-moi',
  },
} as const

export function notify(lang: Lang, plan: 'licence' | 'cloud') {
  return `${ADDRESS}?subject=${encodeURIComponent(SUBJECTS[lang][plan])}`
}

export const LINKS = {
  app: '/',
  contact: ADDRESS,
} as const
