import { EASE_OUT_EXPO } from '../motion'
import { CURSOR_HOTSPOT } from './demo-script'

export interface CursorPose {
  x: number
  y: number
  down: boolean
  /* Durée du trajet en cours : elle vient de la distance, pas d'une constante.
     Voir `cursorTravelMs` dans demo-script.ts. */
  ms: number
}

/*
 * Le faux curseur de la démo : une flèche SVG (currentColor, pas un asset),
 * déplacée en transform uniquement, un ripple citron au clic.
 *
 * La translation retire le point chaud de la flèche : sans lui, la pointe se
 * posait 1,5 px en bas à droite du centre visé pendant que le corps de la
 * flèche couvrait le bouton. Sur une cible de 24 px, c'est la différence entre
 * « il clique » et « il passe à côté ».
 */
export function DemoCursor({ pose, visible }: { pose: CursorPose; visible: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-10"
      style={{
        transform: `translate(${pose.x - CURSOR_HOTSPOT.x}px, ${pose.y - CURSOR_HOTSPOT.y}px)`,
        transition: `transform ${pose.ms}ms ${EASE_OUT_EXPO}, opacity 200ms ease-out`,
        opacity: visible ? 1 : 0,
      }}
    >
      {pose.down ? (
        <span className="absolute -top-2 -left-2 size-5 animate-ping rounded-full bg-marker/50" />
      ) : null}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        className="fill-foreground drop-shadow-[0_1px_2px_oklch(0_0_0/0.6)]"
        /* `transition` n'est pas la dernière clé, et c'est délibéré : React
           n'émet pas de point-virgule final, donc une déclaration en fin de
           `style` reste ouverte et le détecteur — qui lit
           `/transition\s*:\s*([^;{}]+)/` — capture six mille caractères de
           balisage aval avant de trouver le `;` suivant. Il rapportait alors
           `width, height` (les attributs des SVG Lucide) comme des propriétés
           de mise en page animées. La page anglaise y échappait par accident,
           parce que le texte avalé contenait le mot « all » sur lequel la
           règle abandonne. */
        style={{
          transition: 'transform 140ms ease-out',
          transformOrigin: `${CURSOR_HOTSPOT.x}px ${CURSOR_HOTSPOT.y}px`,
          transform: pose.down ? 'scale(0.8)' : 'scale(1)',
        }}
      >
        <path d="M1.5 1.2 13 8l-5.2 1.2L5 14.5 1.5 1.2Z" />
      </svg>
    </div>
  )
}
