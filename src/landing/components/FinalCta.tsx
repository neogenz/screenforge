import { useLang } from '../i18n'
import { LINKS } from '../links'
import { CtaPrimary } from './cta'

export function FinalCta() {
  const { t } = useLang()
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {t.finalCta.headline}
        </h2>
        <div className="mt-9">
          <CtaPrimary href={LINKS.app}>{t.finalCta.cta}</CtaPrimary>
        </div>
      </div>
    </section>
  )
}
