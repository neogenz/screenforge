import { ArrowRight, Check, Folder } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLang } from '../i18n'
import { useReducedMotion } from '../motion'
import { BoardStrip, ProgressBar, StatusIcon } from './session-figure'
import { SCREENS, sleep, useInView, type StepState } from './session-timeline'

/*
 * Le rafraîchissement qui se joue : le dossier se lit, chaque fichier trouve
 * son appareil l'un après l'autre, et sur la bande des dix écrans seul
 * l'intérieur de l'appareil change — le fond, l'accroche et le cadre ne
 * bougent pas, c'est toute la promesse, et elle se voit sans phrase. Les six
 * fichiers restants passent en une barre : la liste dit le mécanisme, la
 * barre dit le lot. Les noms suivent la convention de `lib/batch-refresh.ts`,
 * le rôle est le nom du fichier.
 *
 * Même grammaire que la session d'agent : boucle tant que la figure est
 * visible, état final figé sous reduced-motion, citron pour l'étape en cours,
 * coche pour ce qui est fait.
 */

const NAMED = 4
const REST_STEP = NAMED
const REVEAL_MS = 120
const MATCH_MS = 380
const REST_TICK_MS = 200
const HOLD_MS = 3200

interface Session {
  revealed: number
  step: number
  progress: number
  finished: boolean
}

const EMPTY: Session = { revealed: 0, step: -1, progress: 0, finished: false }

export function RefreshTree() {
  const { t } = useLang()
  const copy = t.features.refresh
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLElement>(null)
  const visible = useInView(rootRef)
  const rows = [...copy.figureFiles, copy.figureMore]
  const rest = SCREENS - NAMED
  const FINAL: Session = { revealed: rows.length, step: rows.length, progress: 100, finished: true }
  const [live, setSession] = useState<Session>(FINAL)
  const session = reduced ? FINAL : live

  useEffect(() => {
    if (reduced || !visible) return
    let cancelled = false
    const run = async () => {
      await sleep(400)
      if (cancelled) return
      setSession(EMPTY)
      for (let i = 1; i <= rows.length; i++) {
        await sleep(REVEAL_MS)
        if (cancelled) return
        setSession((s) => ({ ...s, revealed: i }))
      }
      await sleep(500)
      for (let i = 0; i < rows.length; i++) {
        if (cancelled) return
        setSession((s) => ({ ...s, step: i, progress: 0 }))
        if (i === REST_STEP) {
          for (let k = 1; k <= rest; k++) {
            await sleep(REST_TICK_MS)
            if (cancelled) return
            setSession((s) => ({ ...s, progress: (k / rest) * 100 }))
          }
        } else {
          await sleep(MATCH_MS)
        }
      }
      if (cancelled) return
      setSession((s) => ({ ...s, step: rows.length, finished: true }))
      await sleep(HOLD_MS)
      if (!cancelled) void run()
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [reduced, visible, rows.length, rest])

  const fresh =
    session.step > REST_STEP
      ? SCREENS
      : session.step === REST_STEP
        ? NAMED + Math.round((session.progress / 100) * rest)
        : Math.max(session.step, 0)
  const boards = Array.from({ length: SCREENS }, (_, i) => ({ composed: true, fresh: i < fresh }))

  return (
    <figure ref={rootRef}>
      <div className="border border-border/60 bg-background p-5 font-mono text-sm sm:p-6">
        <p className="flex items-center gap-2.5 text-foreground">
          <Folder aria-hidden className="size-4 shrink-0 text-marker" />
          {copy.figureFolder}
        </p>

        <div className="mt-4 rounded-md border border-border/60 bg-card p-3 sm:p-4">
          <ol className="flex flex-col">
            {rows.map((label, i) => {
              const state: StepState =
                i < session.step ? 'done' : i === session.step ? 'running' : 'pending'
              const shown = i < session.revealed
              const named = i < NAMED
              return (
                <li
                  key={label}
                  className={cn(
                    'flex min-h-8 items-start gap-3 py-1 transition-opacity duration-200 sm:items-center',
                    shown ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden={!shown}
                >
                  <span className="mt-0.5 flex sm:mt-0">
                    <StatusIcon state={state} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                    <span
                      className={cn(
                        'transition-colors duration-200',
                        state === 'done' && (named ? 'text-foreground' : 'text-muted-foreground'),
                        state === 'running' && 'text-marker',
                        state === 'pending' && 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                    {state === 'done' && named && (
                      <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <ArrowRight aria-hidden className="size-3 shrink-0" />
                        {copy.figureTarget} {i + 1}
                      </span>
                    )}
                    {state === 'running' && i === REST_STEP && (
                      <ProgressBar value={session.progress} />
                    )}
                  </span>
                </li>
              )
            })}
          </ol>

          {/* Les dix écrans, déjà composés : seul l'appareil s'allume quand sa
              capture arrive. Le reste ne bouge pas, et c'est le point. */}
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
          <span>{copy.figureResult}</span>
        </p>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">{copy.figureLabel}</figcaption>
    </figure>
  )
}
