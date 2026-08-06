import { DemoEditor } from '../demo/DemoEditor'
import { useLang } from '../i18n'
import { LINKS } from '../links'
import { REVEAL_STAGGER_MS } from '../motion'
import { CtaGhost, CtaPrimary } from './cta'
import { DimensionNote } from './DimensionNote'
import { Reveal } from './Reveal'
import { SpecLabel } from './SpecLabel'

export function Hero() {
  const { t } = useLang()
  return (
    <section
      id="hero"
      className="border-b border-border/60 px-5 pt-32 pb-16 md:px-10 md:pt-40 md:pb-20"
    >
      <div className="max-w-3xl">
        <Reveal>
          <SpecLabel>{t.spec.hero}</SpecLabel>
          <h1 className="mt-6 text-[clamp(2.2rem,5.5vw,4.2rem)] leading-[1.02] font-black tracking-[-0.02em] text-balance uppercase">
            {t.hero.headline}
          </h1>
        </Reveal>
        <Reveal delay={REVEAL_STAGGER_MS}>
          <p className="mt-6 max-w-[65ch] text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            {t.hero.sub}
          </p>
        </Reveal>
        <Reveal delay={REVEAL_STAGGER_MS * 2}>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <CtaPrimary href={LINKS.app}>{t.hero.ctaPrimary}</CtaPrimary>
            <CtaGhost href="#pricing">{t.hero.ctaSecondary}</CtaGhost>
          </div>
        </Reveal>
      </div>
      <Reveal delay={REVEAL_STAGGER_MS * 3} className="relative mt-16">
        <figure>
          <DemoEditor />
          <figcaption className="mt-3 text-xs text-muted-foreground">{t.demo.caption}</figcaption>
        </figure>
        <DimensionNote value="1320 px" className="mt-2" />
        <DimensionNote
          orientation="vertical"
          value="2868 px"
          className="absolute inset-y-0 -right-8 hidden lg:flex"
        />
      </Reveal>
    </section>
  )
}
