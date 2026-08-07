import { renderToString } from 'react-dom/server'
import { Landing } from './Landing'
import { initLang, type Lang } from './i18n'

export { copy } from './copy'

/* Rendu chaîne pour le prerender — consommé par scripts/prerender-landing.mjs. */
export function render(lang: Lang): string {
  initLang(lang)
  return renderToString(<Landing />)
}
