import { useLang } from '../i18n'
import { LINKS } from '../links'
import { LangLink } from './LangLink'

/*
 * Ni « Confidentialité » ni « Conditions » ici : ces deux entrées étaient des
 * `<span>` inertes, c'est-à-dire des liens morts déguisés. Elles reviendront en
 * même temps que le paiement, avec de vraies pages derrière — un document légal
 * à moitié rempli vaut moins qu'un lien absent.
 */
export function Footer() {
  const { t, lang } = useLang()
  return (
    <footer className="px-5 py-10 md:px-10">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
        <span className="font-display text-3xl leading-none text-foreground italic">
          ScreenForge
        </span>
        <a
          className="py-1 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          href={LINKS.contact}
        >
          {t.footer.contact}
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
