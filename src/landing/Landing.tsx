import { useLang } from './i18n'
import { LINKS } from './links'

export function Landing() {
  const { t, lang, setLang } = useLang()
  return (
    <>
      <header>
        <nav aria-label="Principal">
          <a href="#features">{t.nav.features}</a>
          <a href="#pricing">{t.nav.pricing}</a>
          <a href="#faq">{t.nav.faq}</a>
          <button
            type="button"
            aria-label={t.nav.langSwitchLabel}
            onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
          >
            {lang === 'en' ? 'FR' : 'EN'}
          </button>
          <a href={LINKS.app}>{t.nav.cta}</a>
        </nav>
      </header>
      <main>
        <section id="hero" />
        <section id="features" />
        <section id="pricing" />
        <section id="faq" />
      </main>
      <footer />
    </>
  )
}
