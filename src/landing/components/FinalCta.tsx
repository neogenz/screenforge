import { useLang } from '../i18n'
import { LINKS, notify } from '../links'
import { CtaGhost, CtaPrimary } from './cta'

/*
 * Deux actions, parce que la page en a deux à conclure. Elle défend un prix
 * sur trois sections puis terminait sur « ouvrir gratuitement » : le dernier
 * temps rétractait l'argument commercial. Le gratuit reste l'action première —
 * c'est la seule qui aboutit aujourd'hui — mais la Licence obtient sa demande.
 *
 * Le seul aplat citron de la page, et il est ici.
 *
 * Le citron sert partout ailleurs en trait, en pastille, en filet de cote :
 * des doses de quelques pixels, dont l'œil finit par ne plus rien faire. Une
 * couleur de marque n'existe vraiment qu'une fois posée en surface, et une
 * page qui ne le fait jamais n'a pas de couleur, elle a une décoration. La
 * poser une seule fois, au dernier écran, lui rend sa charge entière : c'est
 * le moment où la page arrête de démontrer et demande.
 *
 * Une seule encre dessus. Sur un fond saturé un `muted-foreground` n'est pas
 * un gris atténué, c'est une salissure — la hiérarchie passe donc par le
 * corps et la face, pas par l'opacité. `marker-ink` sur `marker` est un
 * couple fermé, mesuré à 11,47:1 par `audit:contrast`.
 *
 * La section perd son filet bas : un trait de séparation sur le bord d'un
 * aplat qui touche le pied de page ne sépare rien, il souligne.
 */
export function FinalCta() {
  const { lang, t } = useLang()
  return (
    <section
      aria-labelledby="final-title"
      className="bg-marker px-5 py-20 text-center text-marker-ink md:px-14 md:py-28"
    >
      <h2
        id="final-title"
        className="mx-auto max-w-4xl font-display text-[clamp(2.8rem,5.8vw,5rem)] leading-[1.02] font-normal tracking-[-0.025em] text-balance"
      >
        {t.finalCta.headline}
      </h2>
      <p className="mx-auto mt-6 max-w-[60ch] text-[15px] leading-6 font-medium">
        {t.finalCta.body}
      </p>
      {/* « Pas encore ouvert » légendait le seul bouton qui marche : posée
          sous la rangée, la mention s'alignait à gauche, donc sous le CTA
          gratuit. Elle appartient au bouton Licence, et le suit quand la
          rangée passe à la ligne. */}
      {/* Les deux boutons s'inversent sur l'aplat : l'encre devient la couleur
          de remplissage, le citron devient le texte. `outline-ring` est du
          citron lui aussi, donc invisible ici — l'anneau de focus repasse sur
          l'encre, la seule valeur contrastée disponible sur ce fond. */}
      <div className="mt-9 flex flex-wrap items-start justify-center gap-3">
        <CtaPrimary
          href={LINKS.app}
          className="border-marker-ink bg-marker-ink text-marker hover:border-marker-ink hover:bg-transparent hover:text-marker-ink focus-visible:outline-marker-ink"
        >
          {t.finalCta.cta}
        </CtaPrimary>
        <div className="flex flex-col">
          <CtaGhost
            href={notify(lang, 'licence')}
            className="border-marker-ink text-marker-ink hover:bg-marker-ink hover:text-marker focus-visible:outline-marker-ink"
          >
            {t.finalCta.ctaLicence}
          </CtaGhost>
          <p className="mt-2 text-center font-mono text-2xs text-marker-ink">
            {t.pricing.availabilityShort}
          </p>
        </div>
      </div>
    </section>
  )
}
