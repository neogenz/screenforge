import { useLang } from '../i18n'
import { LINKS } from '../links'
import { BrandWordmark } from './BrandWordmark'
import { LangLink } from './LangLink'

export function Footer({ onPrivacyPreferences }: { onPrivacyPreferences: () => void }) {
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
          href="/privacy.html"
        >
          {t.footer.privacy}
        </a>
        <button
          className="py-1 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          type="button"
          onClick={onPrivacyPreferences}
        >
          {t.footer.preferences}
        </button>
        <LangLink code={lang === 'en' ? 'fr' : 'en'} />
        <span className="ml-auto text-xs">{t.footer.copyright}</span>
      </div>
    </footer>
  )
}
