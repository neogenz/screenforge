import { useLang } from '../i18n'
import { LINKS } from '../links'
import { CtaPrimary } from './cta'
import { Reveal } from './Reveal'

export function FinalCta() {
  const { t } = useLang()
  return (
    <section className="border-b border-border/60 px-5 py-20 md:px-10 md:py-28">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {t.finalCta.headline}
        </h2>
        <div className="mt-9">
          <CtaPrimary href={LINKS.app}>{t.finalCta.cta}</CtaPrimary>
        </div>
      </Reveal>
    </section>
  )
}
