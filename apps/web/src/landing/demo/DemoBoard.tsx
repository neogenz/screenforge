import { cn } from '@/lib/utils'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DemoPhoneApp } from './DemoPhoneApp'
import {
  DEMO_GRADIENTS,
  DEVICE_HEIGHT_PCT,
  FRAME_COLORS,
  TEXT_COLORS,
  TEXT_SIZES,
  type DemoLayerId,
  type DemoSceneState,
} from './demo-script'

/*
 * Un dégradé ne s'interpole pas : `transition-[background]` sur la planche ne
 * faisait rien, la couleur sautait. Les trois fonds sont donc empilés et c'est
 * l'opacité qui transite — interruptible, composée par le GPU, et le fondu
 * redevient la preuve que le changement s'applique instantanément.
 */
export function GradientLayers({ index, className }: { index: number; className?: string }) {
  return DEMO_GRADIENTS.map((gradient, position) => (
    <span
      key={gradient.name}
      aria-hidden
      className={cn('absolute inset-0 transition-opacity duration-500 ease-out', className)}
      style={{ background: gradient.css, opacity: index === position ? 1 : 0 }}
    />
  ))
}

const HANDLE_CORNERS = [
  '-top-[3px] -left-[3px]',
  '-top-[3px] -right-[3px]',
  '-bottom-[3px] -left-[3px]',
  '-bottom-[3px] -right-[3px]',
]

/*
 * La sélection du vrai canvas, en DOM : quatre poignées rondes blanches
 * cerclées de noir, jamais les milieux d'arête. Les constantes viennent de
 * `lib/canvas/canvas-utils.ts` (cornerStyle circle, SELECTION_INK `#fff`,
 * SELECTION_HALO noir 60 %) et le halo est là pour la même raison que sur le
 * canvas : une poignée blanche sur un dégradé clair disparaît.
 *
 * Un simple contour, ce qu'il y avait avant, dit « survolé ». Ce sont les
 * poignées qui disent « éditeur ».
 */
function SelectionFrame() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 outline -outline-offset-1 outline-white/90"
    >
      {HANDLE_CORNERS.map((corner) => (
        <span
          key={corner}
          className={cn('absolute size-1.5 rounded-full bg-white ring-1 ring-black/60', corner)}
        />
      ))}
    </span>
  )
}

export interface BoardEdit {
  selected: DemoLayerId | null
  caret: boolean
  onPointerDown: (event: ReactPointerEvent, layer: DemoLayerId) => void
  onPointerMove: (event: ReactPointerEvent) => void
  onPointerUp: () => void
}

/*
 * Une planche du plan de travail.
 *
 * Le mock n'en portait qu'une, centrée dans une scène de 800 px : la planche
 * mesurait 228 px de large et le reste était de la trame. Un outil qui vend
 * « un jeu de dix écrans » montrait un écran seul sur un fond vide, et rien
 * dans la maquette ne disait à quoi ressemble le plan de travail réel — où les
 * planches sont côte à côte et où l'on voit celles d'à côté déborder.
 *
 * Les voisines portent toujours le fond, parce que le fond est un réglage de
 * projet ; elles ne se remplissent qu'au clic sur « Tous les écrans », qui est
 * exactement l'instant où le produit prétend appliquer la composition au jeu.
 * Le titre et l'écran d'app diffèrent d'une planche à l'autre : dix planches
 * identiques diraient l'inverse de ce que l'outil fait.
 */
export function DemoBoard({
  scene,
  title,
  sub,
  variant,
  appLabel,
  filled,
  current,
  edit,
  boardRef,
  className,
}: {
  scene: DemoSceneState
  title: string
  sub: string
  variant: number
  appLabel: string
  filled: boolean
  current: boolean
  edit?: BoardEdit
  boardRef?: React.Ref<HTMLDivElement>
  className?: string
}) {
  /* Un calque de texte n'existe qu'à partir de son premier caractère : la
     planche courante est « remplie » dès que le cadre est posé, et le bloc
     titre se rendait vide, avec son curseur qui clignotait au milieu du fond
     avant même que l'outil Texte soit choisi. */
  const showText = filled && title.length > 0 && !scene.hidden.includes('text')
  const showDevice = filled && !scene.hidden.includes('device')
  const bezel = FRAME_COLORS[scene.frameColor]
  const ink = TEXT_COLORS[scene.textColor]
  const size = TEXT_SIZES[scene.textSize].size
  /* Traitement global, position locale : c'est le découpage du produit
     (`GlobalSettings` porte la police, la couleur, le fond et le modèle de
     téléphone — jamais un `left`/`top`). Une voisine suit donc les pastilles
     et garde sa mise en place. */
  const textPos = current ? scene.textPos : scene.spreadTextPos
  const devicePos = current ? scene.devicePos : scene.spreadDevicePos

  return (
    <div
      ref={boardRef}
      data-cursor-target={current ? 'stage' : undefined}
      /* La planche est son propre conteneur : le titre se dimensionne en
         `cqw`, comme la maquette d'app dans le cadre. Un `clamp` en `vw` liait
         la taille du titre à celle de la fenêtre alors qu'elle dépend de la
         planche — à 390 px de large la planche rétrécit et le titre, lui,
         restait à son plancher.

         La planche courante est celle qui flotte, pas celle qui porte un
         anneau : même règle que le plan de travail du produit, et un trait
         posé sur le bord d'une planche se fait recouvrir par ce qu'on y pose. */
      className={cn(
        'relative h-full shrink-0 overflow-hidden rounded-sm transition-shadow duration-300',
        current ? 'shadow-xl' : 'shadow-md',
        !current && 'pointer-events-none',
        className,
      )}
      style={{ aspectRatio: '1320 / 2868', containerType: 'inline-size' }}
    >
      <GradientLayers index={scene.bgIndex} />

      {showText ? (
        <div
          data-cursor-target={current ? 'text-layer' : undefined}
          onPointerDown={edit ? (event) => edit.onPointerDown(event, 'text') : undefined}
          onPointerMove={edit?.onPointerMove}
          onPointerUp={edit?.onPointerUp}
          className={cn(
            'absolute w-[92%] -translate-x-1/2 -translate-y-1/2 text-center',
            edit && 'cursor-grab active:cursor-grabbing',
          )}
          style={{ left: `${textPos.x}%`, top: `${textPos.y}%` }}
        >
          <p
            /* La couleur transite, pas le corps : `font-size` est une
               propriété de mise en page, et dans un éditeur régler une taille
               est instantané — l'animer ferait joli une fois et mentirait sur
               ce que fait le produit.

               L'interligne est écrit ici : `leading-tight` n'existe pas dans
               la feuille compilée (`--leading-*: initial` retire les utilitaires
               nommés), donc le titre était rendu à ~1,43 — un tiers plus lâche
               que n'importe quel titre de planche publiée, et c'est ce détail
               qui faisait lire la planche comme un gabarit. */
            className="font-bold text-balance drop-shadow-[0_1px_2px_oklch(0_0_0/0.4)] transition-[color] duration-200 ease-out"
            style={{ fontSize: `${size}cqw`, lineHeight: 1.06, color: ink }}
          >
            {title}
            {edit?.caret ? (
              <span
                aria-hidden
                className="ml-px inline-block h-[1em] w-px animate-pulse align-text-bottom"
                style={{ background: ink }}
              />
            ) : null}
          </p>
          {/* La sous-ligne : aucune planche publiée ne porte un titre seul.
              Elle n'apparaît qu'une fois la frappe finie — deux curseurs qui
              écrivent en même temps ne se voient nulle part. */}
          {edit?.caret ? null : (
            <p
              className="mx-auto w-[86%] text-balance transition-[color,opacity] duration-300 ease-out"
              style={{
                marginTop: `${size * 0.34}cqw`,
                fontSize: `${size * 0.46}cqw`,
                lineHeight: 1.25,
                fontWeight: 500,
                color: ink,
                opacity: 0.78,
              }}
            >
              {sub}
            </p>
          )}
          {edit && edit.selected === 'text' ? <SelectionFrame /> : null}
        </div>
      ) : null}

      {showDevice ? (
        <div
          onPointerDown={edit ? (event) => edit.onPointerDown(event, 'device') : undefined}
          onPointerMove={edit?.onPointerMove}
          onPointerUp={edit?.onPointerUp}
          /* `animation-duration-300`, pas `duration-300` : le second pose
             `transition-duration` en plus de nourrir l'entrée, et rien ici ne
             déclare `transition-property`, dont la valeur initiale est `all`.
             `left` et `top` transitionnaient donc sur 300 ms à chaque
             `pointermove` — le cadre rejoignait le curseur en retard, sur une
             courbe d'aisance, ce qui se lit exactement comme une saccade.
             Aucun autre calque n'était touché parce qu'aucun autre ne porte
             d'animation d'entrée. */
          className={cn(
            'absolute w-max -translate-x-1/2 -translate-y-1/2 animate-mark',
            edit && 'cursor-grab active:cursor-grabbing',
          )}
          style={{
            left: `${devicePos.x}%`,
            top: `${devicePos.y}%`,
            height: `${DEVICE_HEIGHT_PCT}%`,
          }}
        >
          {/* L'ombre portée est ce qui pose le téléphone sur le fond. Sans elle
              il est collé dessus, ce qu'aucune planche App Store publiée ne
              montre. */}
          <div
            /* Le châssis se mesure en `cqw` de la planche, pas en pixels : un
               `border-2` fixe donnait un liseré de deux pixels sur un
               téléphone rendu 180 px de large — un cheveu là où un iPhone
               porte 2,5 % de sa largeur. À 1,6cqw il tient sa proportion que
               la planche fasse 130 px ou 260. */
            className="relative h-full overflow-hidden border-solid transition-[border-color] duration-300 ease-out"
            style={{
              aspectRatio: '1170 / 2532',
              borderRadius: '16% / 8%',
              borderWidth: '1.6cqw',
              borderColor: bezel,
              boxShadow: '0 3px 14px oklch(0 0 0 / 0.38)',
            }}
          >
            {/* Le liseré noir de la dalle, entre le châssis et l'écran. Un
                iPhone en porte un quelle que soit sa couleur, et c'est lui qui
                fait lire la silhouette : en « Argent » le châssis blanc et
                l'écran blanc de l'app se fondaient en une seule plaque, sans
                bord — un rectangle, pas un téléphone. */}
            <div
              className="h-full overflow-hidden border-solid border-black bg-black"
              style={{ borderRadius: '14.5% / 7.2%', borderWidth: '1cqw' }}
            >
              <DemoPhoneApp label={appLabel} variant={variant} />
            </div>
            <span className="absolute top-[2.4%] left-1/2 h-[3.2%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
          </div>
          {edit && edit.selected === 'device' ? <SelectionFrame /> : null}
        </div>
      ) : null}
    </div>
  )
}

/*
 * La vignette du filmstrip rejoue la composition de sa planche, aux mêmes
 * coordonnées : c'est là que « appliqué aux dix » se démontre au lieu de
 * s'annoncer. Un emplacement vide est un contour, pas un dégradé assombri — à
 * 25 % d'opacité le rose du fond vire au bordeaux et se lit comme une vignette
 * cassée.
 *
 * Le rang au-dessus, la vignette courante qui se soulève et porte le badge
 * citron : c'est le filmstrip du produit (`ScreenThumbnail`), à son échelle.
 * Dix pastilles roses de 17 px sans rang ni état ne prouvaient pas « dix
 * écrans », elles faisaient un motif.
 */
export function DemoTile({
  scene,
  filled,
  current,
  rank,
  titleWidth,
}: {
  scene: DemoSceneState
  filled: boolean
  current: boolean
  rank: number
  titleWidth: number
}) {
  const showText = filled && !scene.hidden.includes('text')
  const showDevice = filled && !scene.hidden.includes('device')
  const textPos = current ? scene.textPos : scene.spreadTextPos
  const devicePos = current ? scene.devicePos : scene.spreadDevicePos
  return (
    /* L'état de remplissage est déclaré : c'est ce que `landing.spec.ts` compte
       pour vérifier que la démo ne démarre jamais sur un plan de travail vide,
       et une vignette pleine ne se distingue autrement que par sa peinture. */
    <div className="flex flex-col items-center gap-1" data-demo-tile={filled ? 'filled' : 'empty'}>
      <span
        className={cn(
          'grid size-3 place-items-center rounded-full font-mono text-[8px] leading-none font-semibold tabular-nums',
          current ? 'bg-marker text-marker-ink' : 'text-muted-foreground',
        )}
      >
        {rank}
      </span>
      <div
        className={cn(
          'relative h-8 overflow-hidden rounded-[3px] transition-[transform,box-shadow] duration-300 md:h-11',
          filled ? 'outline -outline-offset-1 outline-white/10' : 'border border-border/60',
          current && filled && '-translate-y-0.5 shadow-(--shadow-handle)',
        )}
        style={{ aspectRatio: '1320 / 2868' }}
      >
        {filled ? (
          <>
            <GradientLayers index={scene.bgIndex} />
            {showText ? (
              /* La largeur du titre varie d'une vignette à l'autre : dix barres
               identiques annoncent dix fois la même planche, et le produit
               vend l'inverse. */
              <span
                className="absolute h-[4%] -translate-x-1/2 -translate-y-1/2 rounded-[1px]"
                style={{
                  left: `${textPos.x}%`,
                  top: `${textPos.y}%`,
                  width: `${titleWidth}%`,
                  background: TEXT_COLORS[scene.textColor],
                }}
              />
            ) : null}
            {showDevice ? (
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 border bg-white/85"
                style={{
                  left: `${devicePos.x}%`,
                  top: `${devicePos.y}%`,
                  height: `${DEVICE_HEIGHT_PCT}%`,
                  aspectRatio: '1170 / 2532',
                  borderRadius: '16% / 8%',
                  borderColor: FRAME_COLORS[scene.frameColor],
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
