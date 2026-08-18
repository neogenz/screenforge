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
 *
 * Le hero est le texte, et rien que lui : citron, titre, sous-titre, deux
 * boutons. La démo vient juste après, dans le bloc sombre, et remonte de
 * `SHOWCASE_OVERLAP` sur le citron (`ProductShowcase`) : le produit est
 * au-dessus du pli, ce qui est la seule règle qui compte ici, et le hero
 * garde ses deux aplats — le citron pour la promesse, le noir pour la chose.
 * Le bas du hero réserve la place que la démo vient prendre.
 */
export function Hero() {
  const { t } = useLang()

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-marker px-5 pt-28 pb-40 text-marker-ink md:px-14 md:pt-32 md:pb-48"
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
        {/* Le sous-titre a sa propre clairière : un fond citron dont l'ombre, à
            large flou, éteint l'éventail sur une trentaine de pixels autour du
            bloc. Mesuré à 980px de large : les rayons à 0,28 d'alpha traversaient
            trois lignes de 18px, et un texte de labeur ne survit pas à des
            traits d'encre qui le hachent, là où le titre à 100px les ignore.
            Pas de plaque nette : `bg-marker` sur `bg-marker` ne dessine aucun
            bord, seule l'ombre floue fait le travail. */}
        <p className="mt-8 max-w-[62ch] rounded-lg bg-marker text-base leading-7 font-medium text-pretty shadow-[0_0_28px_24px_var(--color-marker)] md:text-lg md:leading-8">
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
