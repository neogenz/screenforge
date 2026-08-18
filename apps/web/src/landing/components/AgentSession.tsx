import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLang } from '../i18n'
import { useReducedMotion } from '../motion'
import { BoardStrip, ProgressBar, StatusIcon } from './session-figure'
import { SCREENS, sleep, useInView, type StepState } from './session-timeline'

/*
 * Une session d'agent qui se joue : la consigne se tape, les quatre appels
 * d'outils passent l'un après l'autre (fait, en cours, à venir), et pendant
 * `screenforge_apply` dix vignettes se remplissent au rythme de la barre —
 * c'est ce qui dit « il met les écrans à jour » sans une phrase de plus. Les
 * noms d'outils sont ceux qu'`apps/mcp` expose vraiment ; ce que chacun rend
 * est en marge, atténué, parce que c'est la trace et pas l'ordre.
 *
 * Non interactive, en boucle tant qu'elle est visible, rendue finie dans le
 * HTML, et figée sur son état final sous reduced-motion : la scène complète est l'information, l'animation
 * n'est que la manière de la lire. Le citron marque l'étape en cours (« tu es
 * ici »), la coche ce qui est fait ; rien de chromatique ailleurs. Le glyphe
 * de fin est une icône Lucide, pas un caractère coche : la vitrine interdit
 * les symboles de la plage emoji.
 */

const APPLY_STEP = 2
const THUMBNAIL_STEP = 3
const TYPE_MS = 18
const STEP_MS = [500, 900, 0, 700]
const APPLY_TICK_MS = 240
const HOLD_MS = 3200

interface Session {
  typed: number
  step: number
  progress: number
  finished: boolean
}

const EMPTY: Session = { typed: 0, step: -1, progress: 0, finished: false }

export function AgentSession() {
  const { t } = useLang()
  const copy = t.agent
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLElement>(null)
  const visible = useInView(rootRef)
  const steps = copy.sessionSteps
  const prompt = copy.sessionPrompt
  const FINAL: Session = { typed: prompt.length, step: steps.length, progress: 100, finished: true }
  /* Elle naît finie : c'est ce que le HTML pré-rendu montre sans JS, et ce
     qu'un lecteur voit avant que la boucle ne reparte du début une fois la
     figure à l'écran. */
  const [live, setSession] = useState<Session>(FINAL)
  const session = reduced ? FINAL : live

  useEffect(() => {
    if (reduced || !visible) return
    let cancelled = false
    const run = async () => {
      await sleep(400)
      if (cancelled) return
      setSession(EMPTY)
      for (let i = 1; i <= prompt.length; i++) {
        if (cancelled) return
        setSession((s) => ({ ...s, typed: i }))
        await sleep(TYPE_MS)
      }
      await sleep(500)
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return
        setSession((s) => ({ ...s, step: i, progress: 0 }))
        if (i === APPLY_STEP) {
          for (let k = 1; k <= SCREENS; k++) {
            await sleep(APPLY_TICK_MS)
            if (cancelled) return
            setSession((s) => ({ ...s, progress: (k / SCREENS) * 100 }))
          }
        } else {
          await sleep(STEP_MS[i])
        }
      }
      if (cancelled) return
      setSession((s) => ({ ...s, step: steps.length, finished: true }))
      await sleep(HOLD_MS)
      if (!cancelled) void run()
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [reduced, visible, prompt, steps.length])

  const typing = session.typed < prompt.length
  const filled =
    session.step > APPLY_STEP
      ? SCREENS
      : session.step === APPLY_STEP
        ? Math.round((session.progress / 100) * SCREENS)
        : 0
  const boards = Array.from({ length: SCREENS }, (_, i) => ({
    composed: i < filled,
    fresh: i < filled,
    ring: i === 0 && session.step >= THUMBNAIL_STEP,
  }))

  return (
    <figure ref={rootRef}>
      <div className="border border-border/60 bg-background p-5 font-mono text-sm sm:p-6">
        <p className="flex gap-2 text-foreground">
          <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-marker" />
          {/* La consigne complète est posée invisible sous le texte tapé : les
              deux ont la même largeur, donc les mêmes retours à la ligne, et le
              bloc ne saute pas pendant la frappe. */}
          <span className="relative">
            <span aria-hidden className="invisible">
              {prompt}
            </span>
            <span className="absolute inset-0">
              {prompt.slice(0, session.typed)}
              {typing && !reduced && (
                <span
                  aria-hidden
                  className="ml-px inline-block h-[1.1em] w-[0.55ch] animate-pulse bg-marker align-text-bottom"
                />
              )}
            </span>
          </span>
        </p>

        <div className="mt-4 rounded-md border border-border/60 bg-card p-3 sm:p-4">
          <ol className="flex flex-col">
            {steps.map(([tool, note], i) => {
              const state: StepState =
                i < session.step ? 'done' : i === session.step ? 'running' : 'pending'
              return (
                <li key={tool} className="flex min-h-8 items-start gap-3 py-1 sm:items-center">
                  <span className="mt-0.5 flex sm:mt-0">
                    <StatusIcon state={state} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                    <span
                      className={cn(
                        'transition-colors duration-200',
                        state === 'done' && 'text-foreground',
                        state === 'running' && 'text-marker',
                        state === 'pending' && 'text-muted-foreground',
                      )}
                    >
                      {tool}
                    </span>
                    {state === 'done' && (
                      <span className="text-2xs text-muted-foreground">{note}</span>
                    )}
                    {state === 'running' && i === APPLY_STEP && (
                      <ProgressBar value={session.progress} />
                    )}
                  </span>
                </li>
              )
            })}
          </ol>

          {/* Les dix écrans du projet : vides tant que rien n'est écrit,
              remplis un à un pendant `apply`, le premier cerclé quand l'agent
              en relit le rendu. */}
          <div className="mt-3 border-t border-border/60 pt-3">
            <BoardStrip boards={boards} />
          </div>
        </div>

        <p
          aria-hidden={!session.finished}
          className={cn(
            'mt-4 flex items-start gap-2 border-t border-border/60 pt-4 text-muted-foreground transition-opacity duration-300',
            session.finished ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-marker" />
          <span>{copy.sessionDone}</span>
        </p>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">{copy.sessionLabel}</figcaption>
    </figure>
  )
}
