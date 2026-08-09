/*
 * Cibles des liens de la landing. Avant le lancement, une offre payante ouvre
 * la demande de notification. Après, elle entre dans l'éditeur et ouvre sa
 * boîte d'offres, seul endroit qui détient session et checkout.
 *
 * L'objet du mail suit la langue de la page : le sujet était figé en français
 * et s'ouvrait tel quel dans le client mail d'un visiteur anglophone, au seul
 * moment de la page où il a la plus forte intention.
 */
import { commercialLaunch } from '@/lib/commercial-launch'
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

export function offerHref(lang: Lang, plan: 'licence' | 'cloud') {
  return commercialLaunch ? '/?offers=open' : notify(lang, plan)
}

export const LINKS = {
  app: '/',
  contact: ADDRESS,
} as const
