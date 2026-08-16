/* Local ouvre l'éditeur; Cloud ouvre sa boîte d'offres, seul endroit qui
   détient session et checkout. */
import type { Lang } from './i18n'

const ADDRESS = 'mailto:hello@screenforge.app'

export function offerHref(_lang: Lang, plan: 'local' | 'cloud') {
  return plan === 'local' ? '/' : '/?offers=open'
}

export const LINKS = {
  app: '/',
  contact: ADDRESS,
} as const
