import { useLang } from '../i18n'
import { LINKS } from '../links'
import { CtaGhost, CtaPrimary } from './cta'

/*
 * Le hero et le dernier écran sont les deux aplats citron de la page, et ils
 * portent la même paire de boutons : la page s'ouvre et se ferme sur la même
 * demande. Entre les deux, tout est sombre.
 *
 * L'encre est `marker-ink`, pas du blanc. Un bouton blanc sur le citron a un
 * filet à 1,4:1 — sous les 3:1 que WCAG 1.4.11 demande à la limite d'un
 * contrôle — donc une pastille qui flotte sans bord. `marker-ink` sur
 * `marker` est le couple fermé déjà mesuré par `audit:contrast`.
 *
 * Aucun objet décoratif posé sur la rangée de boutons : le disque texturé qui
 * s'y trouvait recouvrait la fin du libellé de l'action principale.
 */
export function Hero() {
  const { t } = useLang()

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative flex min-h-[700px] items-center overflow-hidden bg-marker px-5 pt-32 pb-24 text-marker-ink md:min-h-[760px] md:px-14 md:pt-36 md:pb-28"
    >
      <div aria-hidden className="paint-hero absolute inset-0" />
      <div aria-hidden className="arcade-rays absolute inset-0" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center">
        <h1
          id="hero-title"
          className="max-w-[13ch] font-display text-[clamp(3.2rem,7.6vw,6.1rem)] leading-[0.98] font-normal tracking-[-0.028em] text-balance"
        >
          {t.hero.headline}
        </h1>
        <p className="mt-8 max-w-[62ch] text-base leading-7 font-medium md:text-lg md:leading-8">
          {t.hero.sub}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <CtaPrimary
            href={LINKS.app}
            className="border-marker-ink bg-marker-ink text-marker hover:border-marker-ink hover:bg-transparent hover:text-marker-ink focus-visible:outline-marker-ink"
          >
            {t.hero.ctaPrimary}
          </CtaPrimary>
          <CtaGhost
            href="#pricing"
            className="border-marker-ink text-marker-ink hover:bg-marker-ink hover:text-marker focus-visible:outline-marker-ink"
          >
            {t.hero.ctaSecondary}
          </CtaGhost>
        </div>
      </div>
    </section>
  )
}
