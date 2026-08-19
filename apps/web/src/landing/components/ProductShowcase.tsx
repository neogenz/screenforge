import { DemoEditor } from '../demo/DemoEditor'
import { useLang } from '../i18n'
import { useReducedMotion } from '../motion'

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
 * Les cotes ont quitté le pourtour de la maquette : « 1320 px » sous une
 * fenêtre d'éditeur mesurait le chrome, pas la planche. La mesure vit dans
 * la démo, sous la planche courante (`DemoEditor`).
 *
 * La section suit le hero immédiatement et la démo chevauche la couture :
 * elle remonte de 96 px (112 dès `md`) sur le citron, dont le hero a réservé
 * la place dans son `pb`. C'est ce qui met le produit au-dessus du pli sans
 * le poser dans le hero — mesuré, à 1440×900 il en manquait 1400 px quand la
 * section venait après la marquee et la bande de preuve. Le titre de section
 * est passé hors écran : un en-tête entre les boutons du hero et la démo
 * aurait été le seul texte de la page à couper une image en deux. Pas de
 * `overflow-hidden` sur la section, qui clipperait le débord ; le lavis est
 * une couche `inset-0` et n'en a pas besoin. La section est `flex-col` pour
 * une seule raison : sans padding haut, la marge négative du premier enfant
 * fusionne avec la sienne et c'est tout le bloc sombre qui remonte de 96 px,
 * fond compris — mesuré, la démo se retrouvait exactement sur la couture, à
 * zéro de débord. Un conteneur flex ne fusionne pas ses marges.
 */
export function ProductShowcase() {
  const { t } = useLang()
  const reduced = useReducedMotion()

  return (
    <section
      aria-labelledby="showcase-title"
      className="relative flex flex-col border-b border-border/60 bg-stage px-5 pb-20 md:px-14 md:pb-28"
    >
      <div aria-hidden className="paint-interlude absolute inset-0" />
      <div className="relative z-10 mx-auto -mt-24 w-full max-w-6xl md:-mt-28">
        <h2 id="showcase-title" className="sr-only">
          {t.showcase.title}
        </h2>
        <figure>
          <DemoEditor />
          <figcaption className="mt-5 text-xs text-muted-foreground">
            {reduced ? t.demo.captionStill : t.demo.caption}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
