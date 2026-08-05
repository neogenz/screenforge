import { useLang } from '../i18n'
import { LINKS } from '../links'
import { CtaGhost, CtaPrimary } from './cta'
import { VisualPlaceholder } from './visual'

export function Hero() {
  const { t } = useLang()
  return (
    <section id="hero" className="mx-auto max-w-6xl px-5 pt-36 pb-24 md:pt-44 md:pb-32">
      <div className="max-w-3xl">
        <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance">
          {t.hero.headline}
        </h1>
        <p className="mt-6 max-w-[65ch] text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
          {t.hero.sub}
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <CtaPrimary href={LINKS.app}>{t.hero.ctaPrimary}</CtaPrimary>
          <CtaGhost href="#pricing">{t.hero.ctaSecondary}</CtaGhost>
        </div>
      </div>
      <div className="mt-16 md:-mr-24 md:ml-12">
        <VisualPlaceholder caption={t.hero.visualCaption} />
      </div>
    </section>
  )
}
