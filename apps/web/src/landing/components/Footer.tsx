import { useLang } from '../i18n'
import { LINKS } from '../links'
import { BrandWordmark } from './BrandWordmark'
import { LangLink } from './LangLink'

/*
 * Ni « Confidentialité » ni « Conditions » ici : ces deux entrées étaient des
 * `<span>` inertes, c'est-à-dire des liens morts déguisés. Elles reviendront en
 * même temps que le paiement, avec de vraies pages derrière. Le contact revient
 * avec le domaine vérifié : annoncer une adresse non possédée serait trompeur.
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
        <LangLink code={lang === 'en' ? 'fr' : 'en'} />
        <span className="ml-auto text-xs">{t.footer.copyright}</span>
      </div>
      <p className="mt-6 max-w-[55ch] text-xs leading-4 text-muted-foreground">
        {t.footer.builtBy}
      </p>
    </footer>
  )
}
