import { useLang } from '../i18n'
import { LINKS } from '../links'
import { BrandWordmark } from './BrandWordmark'
import { LangLink } from './LangLink'

/*
 * Ni « Confidentialité » ni « Conditions » ici : ces deux entrées étaient des
 * `<span>` inertes, c'est-à-dire des liens morts déguisés. Elles reviendront en
 * même temps que le paiement, avec de vraies pages derrière — leur place est
 * après `contact`, et elles devront exister en FR et en EN puisque
 * `scripts/prerender-landing.mjs` fige les deux documents.
 *
 * Contact via les issues : ne dépend pas du domaine vérifié. Le libellé dit ce
 * que le lien fait (« Signaler un problème ») plutôt que de promettre une
 * adresse que personne ne possède encore.
 */
export function Footer() {
  const { t, lang } = useLang()
  return (
    <footer className="px-5 py-10 md:px-10">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
        <span className="flex text-foreground">
          <BrandWordmark className="h-9" />
        </span>
        <a
          className="py-1 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          href={LINKS.source}
        >
          {t.footer.source}
        </a>
        <a
          className="py-1 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          href={LINKS.contact}
        >
          {t.footer.contact}
        </a>
        <LangLink code={lang === 'en' ? 'fr' : 'en'} />
        <span className="ml-auto text-xs">{t.footer.copyright}</span>
      </div>
    </footer>
  )
}
