import { useLang } from '../i18n'
import { LINKS } from '../links'
import { LangLink } from './LangLink'

export function Footer() {
  const { t, lang } = useLang()
  return (
    <footer>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-10 text-sm text-muted-foreground md:px-10">
        <span className="font-semibold text-foreground">ScreenForge</span>
        <a className="transition-colors duration-150 hover:text-foreground" href={LINKS.contact}>
          {t.footer.contact}
        </a>
        {/* TODO(légal): pages Confidentialité/Conditions à publier avec le checkout */}
        <span className="text-muted-foreground">{t.footer.privacy}</span>
        <span className="text-muted-foreground">{t.footer.terms}</span>
        <LangLink code={lang === 'en' ? 'fr' : 'en'} />
        <span className="ml-auto text-xs">{t.footer.copyright}</span>
      </div>
    </footer>
  )
}
