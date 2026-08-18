import { Circle, CircleCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEMO_GRADIENTS } from '../demo/demo-script'
import type { StepState } from './session-timeline'

/*
 * Ce que les deux figures qui se jouent (l'agent, le rafraîchissement) ont en
 * commun côté dessin : l'icône d'une étape selon son état, la barre d'un lot,
 * et la bande des dix écrans du projet vus de loin. Chacune garde son propre
 * scénario (`session-timeline.ts` pour ce qu'ils partagent).
 */

export function StatusIcon({ state }: { state: StepState }) {
  if (state === 'done') return <CircleCheck aria-hidden className="size-4 shrink-0 text-marker" />
  if (state === 'running')
    return <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-marker" />
  return <Circle aria-hidden className="size-4 shrink-0 text-muted-foreground/50" />
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <span className="flex w-full max-w-40 items-center gap-2 sm:ml-auto">
      <span className="h-1 flex-1 overflow-hidden bg-border">
        <span
          className="block h-full bg-marker transition-[width] duration-200 ease-linear"
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="tabular w-9 shrink-0 text-right text-2xs text-muted-foreground">
        {Math.round(value)}%
      </span>
    </span>
  )
}

export interface BoardLook {
  /* Un fond, une accroche et un appareil sont posés. */
  composed: boolean
  /* L'appareil montre une capture à jour ; sinon il est éteint. */
  fresh: boolean
  /* Cerclé : c'est celui que l'on relit. */
  ring?: boolean
}

/* Les dix écrans du projet, en vignettes de la taille d'une bande de
   filmstrip. Un fond, un trait d'accroche, un appareil : le minimum qui dit
   « planche composée » à trente pixels de large. Le dégradé est l'un des trois
   presets réels, comme sur la démo. */
export function BoardStrip({ boards }: { boards: BoardLook[] }) {
  return (
    <ol aria-hidden className="grid max-w-xs grid-cols-10 gap-1.5">
      {boards.map((board, i) => (
        <li
          key={i}
          className={cn(
            'relative aspect-[1320/2868] overflow-hidden rounded-[2px] transition-opacity duration-300',
            !board.composed && 'border border-dashed border-border',
            board.ring && 'outline-2 outline-offset-2 outline-marker',
          )}
          style={
            board.composed
              ? { background: DEMO_GRADIENTS[i % DEMO_GRADIENTS.length].css }
              : undefined
          }
        >
          {board.composed && (
            <>
              <span className="absolute top-[8%] left-1/2 h-[3%] w-[60%] -translate-x-1/2 rounded-full bg-white/85" />
              <span
                className={cn(
                  'absolute top-[24%] left-1/2 h-[58%] w-[54%] -translate-x-1/2 rounded-[18%/8%] border transition-colors duration-300',
                  board.fresh ? 'border-white/80 bg-white/25' : 'border-white/40 bg-black/40',
                )}
              />
            </>
          )}
        </li>
      ))}
    </ol>
  )
}
