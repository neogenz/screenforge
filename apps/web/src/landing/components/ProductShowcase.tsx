import { DemoEditor } from '../demo/DemoEditor'
import { useLang } from '../i18n'
import { useReducedMotion } from '../motion'
import { DimensionNote } from './DimensionNote'
import { SectionHeading } from './SectionHeading'

/*
 * Un seul sol pour le titre et la démo. La section était coupée en deux : une
 * carte-titre pêche pleine largeur, puis la démo sur le fond de la page. La
 * barre de navigation, sombre dès le premier défilement, tranchait un bandeau
 * noir en travers de la carte, et l'annonce se retrouvait séparée de la chose
 * qu'elle annonce par un changement de teinte. Le lavis passe derrière les
 * deux, et la teinte ne change plus.
 *
 * La paire de boutons a disparu avec la carte. L'action secondaire y était
 * libellée avec l'entrée de menu « L'éditeur » — un repère de navigation
 * employé comme nom d'action, juste à côté de « Ouvrir l'éditeur
 * gratuitement ». La page demande déjà six fois ailleurs, et la démo est
 * elle-même manipulable : c'est l'affordance de la section.
 *
 * La cote verticale mesure le mock, et le mock seul. Elle était en
 * `inset-y-0` sur un conteneur qui portait aussi la cote horizontale et la
 * légende : le filet descendait 120 px sous l'objet mesuré.
 */
export function ProductShowcase() {
  const { t } = useLang()
  const reduced = useReducedMotion()

  return (
    <section
      aria-labelledby="showcase-title"
      className="relative overflow-hidden border-b border-border/60 bg-stage px-5 py-20 md:px-14 md:py-28"
    >
      <div aria-hidden className="paint-interlude absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <SectionHeading id="showcase-title">{t.showcase.title}</SectionHeading>
        <p className="mx-auto mt-6 max-w-[60ch] text-center text-base leading-7 text-muted-foreground">
          {t.showcase.body}
        </p>

        <figure className="mt-14">
          <div className="relative">
            <DemoEditor />
            <DimensionNote
              orientation="vertical"
              value="2868 px"
              className="absolute inset-y-0 -right-7 hidden md:flex"
            />
          </div>
          <DimensionNote value="1320 px" className="mt-3.5" />
          <figcaption className="mt-5 text-xs text-muted-foreground">
            {reduced ? t.demo.captionStill : t.demo.caption}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
