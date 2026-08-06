import { EASE_OUT_EXPO } from '../motion'
import { CURSOR_TRAVEL_MS } from './demo-script'

export interface CursorPose {
  x: number
  y: number
  down: boolean
}

/*
 * Le faux curseur de la démo : une flèche SVG (currentColor, pas un asset),
 * déplacée en transform uniquement, un ripple citron au clic.
 */
export function DemoCursor({ pose, visible }: { pose: CursorPose; visible: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-10 transition-opacity duration-200"
      style={{
        transform: `translate(${pose.x}px, ${pose.y}px)`,
        transition: `transform ${CURSOR_TRAVEL_MS}ms ${EASE_OUT_EXPO}, opacity 200ms ease-out`,
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
        style={{
          transform: pose.down ? 'scale(0.8)' : 'scale(1)',
          transition: 'transform 140ms ease-out',
        }}
      >
        <path d="M1.5 1.2 13 8l-5.2 1.2L5 14.5 1.5 1.2Z" />
      </svg>
    </div>
  )
}
