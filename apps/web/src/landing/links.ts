/* Local ouvre l'éditeur; Cloud ouvre sa boîte d'offres, seul endroit qui
   détient session et checkout. */
import type { Lang } from './i18n'

export function offerHref(_lang: Lang, plan: 'local' | 'cloud') {
  return plan === 'local' ? '/' : '/?offers=open'
}

export const LINKS = {
  app: '/',
  source: 'https://github.com/neogenz/screenforge',
  contact: 'https://github.com/neogenz/screenforge/issues',
} as const
