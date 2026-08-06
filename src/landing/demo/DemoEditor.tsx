import { cn } from '@/lib/utils'
import { Check, Loader2, Pause, RotateCcw } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useLang } from '../i18n'
import { DemoCursor, type CursorPose } from './DemoCursor'
import {
  CURSOR_CLICK_MS,
  CURSOR_TRAVEL_MS,
  DEMO_GRADIENTS,
  EMPTY_SCENE,
  FINAL_SCENE,
  type CursorTarget,
  type DemoLayerId,
  type DemoSceneState,
} from './demo-script'

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

/* Media query via useSyncExternalStore : le serveur rend « false » (scène
   initiale complète dans le HTML), le client reduced-motion bascule après
   hydratation — sans mismatch, sans setState dans un effet. */
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

function ToolButton({
  target,
  active = false,
  primary = false,
  onClick,
  children,
}: {
  target: CursorTarget
  active?: boolean
  primary?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-cursor-target={target}
      onClick={onClick}
      className={cn(
        'flex h-6 items-center rounded-xs px-2 text-[10px] font-medium transition-colors duration-150',
        primary
          ? 'bg-marker text-marker-ink hover:bg-marker-hover'
          : active
            ? 'bg-accent text-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function SelectedPosition({
  selected,
  layerPos,
}: {
  selected: DemoLayerId
  layerPos: (layer: DemoLayerId) => { x: number; y: number }
}) {
  return (
    <div className="flex gap-2 border-t border-border/60 pt-2.5">
      {(['x', 'y'] as const).map((axis) => (
        <div key={axis} className="flex-1">
          <p className="text-[9px] text-muted-foreground uppercase">{axis}</p>
          <p className="mt-0.5 rounded-xs bg-muted px-1.5 py-1 text-[10px] tabular-nums">
            {Math.round(layerPos(selected)[axis] * 13.2)}
          </p>
        </div>
      ))}
    </div>
  )
}

/*
 * Mini-éditeur mocké : barre d'outils, panneaux Calques/Propriétés, scène et
 * filmstrip — le chrome du produit en simplifié. La démo joue en boucle ;
 * toute prise de main coupe l'autoplay et le board devient manipulable
 * (sélection, drag des calques, fonds), « Rejouer » relance la boucle.
 * Zéro Fabric : à cette échelle le DOM suffit, et le premier état est rendu
 * côté serveur.
 */
export function DemoEditor() {
  const { t } = useLang()
  const typed = t.demo.typed

  const [rawScene, setScene] = useState<DemoSceneState>(EMPTY_SCENE)
  const [touched, setTouched] = useState(false)
  const [cursor, setCursor] = useState<CursorPose>({ x: 0, y: 0, down: false })
  const [cursorOn, setCursorOn] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const artboardRef = useRef<HTMLDivElement>(null)
  const dragLayer = useRef<DemoLayerId | null>(null)

  /* En reduced-motion la composition finale est servie figée — sauf si
     l'utilisateur a pris la main, auquel cas ses actions commandent. */
  const scene = reduced && !touched ? FINAL_SCENE : rawScene
  const playing = autoplay && !reduced

  const manual = (updates: Partial<DemoSceneState>) => {
    setTouched(true)
    setScene((s) => ({ ...s, ...updates }))
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.3,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!playing || !visible) return
    let cancelled = false
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const targetPoint = (name: CursorTarget) => {
      const root = containerRef.current
      const el = root?.querySelector(`[data-cursor-target="${name}"]`)
      if (!root || !el) return null
      const box = root.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      return {
        x: rect.left - box.left + rect.width / 2,
        y: rect.top - box.top + rect.height / 2,
      }
    }

    const moveTo = async (name: CursorTarget) => {
      const point = targetPoint(name)
      if (!point) return
      setCursor((pose) => ({ ...pose, x: point.x, y: point.y, down: false }))
      await sleep(CURSOR_TRAVEL_MS + 40)
    }
    const click = async () => {
      setCursor((pose) => ({ ...pose, down: true }))
      await sleep(CURSOR_CLICK_MS / 2)
      setCursor((pose) => ({ ...pose, down: false }))
      await sleep(CURSOR_CLICK_MS / 2)
    }
    /* Le curseur descend sur le calque, puis curseur et calque glissent
       ensemble vers la destination — le drag est la preuve, pas un cut. */
    const dragTextTo = async (toY: number) => {
      const start = targetPoint('text-layer')
      if (!start) return
      setCursor({ x: start.x, y: start.y, down: true })
      await sleep(CURSOR_TRAVEL_MS + 40)
      const fromY = EMPTY_SCENE.textPos.y
      const steps = 7
      for (let i = 1; i <= steps; i++) {
        if (cancelled) return
        const ratio = i / steps
        setScene((s) => ({ ...s, textPos: { x: 50, y: fromY + (toY - fromY) * ratio } }))
        setCursor((pose) => ({ ...pose, y: start.y + (toY - fromY) * ratio * 2.2 }))
        await sleep(70)
      }
      setCursor((pose) => ({ ...pose, down: false }))
      await sleep(200)
    }

    const run = async () => {
      while (!cancelled) {
        setScene(EMPTY_SCENE)
        setCursorOn(true)
        await moveTo('stage')
        await sleep(500)
        if (cancelled) return

        await moveTo('device-btn')
        await click()
        setScene((s) => ({ ...s, device: true, selected: 'device' }))
        await sleep(900)
        if (cancelled) return

        await moveTo('text-btn')
        await click()
        setScene((s) => ({ ...s, selected: 'text' }))
        for (let i = 1; i <= typed.length; i++) {
          if (cancelled) return
          setScene((s) => ({ ...s, textChars: i }))
          await sleep(42)
        }
        await sleep(400)
        if (cancelled) return

        await dragTextTo(14)
        if (cancelled) return

        await moveTo('bg-swatches')
        for (let g = 1; g < DEMO_GRADIENTS.length; g++) {
          if (cancelled) return
          await click()
          setScene((s) => ({ ...s, bgIndex: g }))
          await sleep(650)
        }
        await click()
        setScene((s) => ({ ...s, bgIndex: 0 }))
        await sleep(500)
        if (cancelled) return

        await moveTo('apply-btn')
        await click()
        for (let n = 1; n <= 4; n++) {
          if (cancelled) return
          setScene((s) => ({ ...s, tiles: n }))
          await sleep(150)
        }
        await sleep(500)
        if (cancelled) return

        await moveTo('export-btn')
        await click()
        setScene((s) => ({ ...s, exportState: 'running' }))
        await sleep(1200)
        if (cancelled) return
        setScene((s) => ({ ...s, exportState: 'done' }))
        await sleep(1700)
        setCursorOn(false)
        await sleep(400)
        if (cancelled) return
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [playing, visible, typed])

  const takeOver = () => {
    setTouched(true)
    if (autoplay) {
      setAutoplay(false)
      setCursorOn(false)
    }
  }

  const layerPos = (layer: DemoLayerId) => (layer === 'device' ? scene.devicePos : scene.textPos)
  const setLayerPos = (layer: DemoLayerId, pos: { x: number; y: number }) =>
    setScene((s) => (layer === 'device' ? { ...s, devicePos: pos } : { ...s, textPos: pos }))

  const onLayerPointerDown = (event: ReactPointerEvent, layer: DemoLayerId) => {
    event.stopPropagation()
    takeOver()
    dragLayer.current = layer
    setScene((s) => ({ ...s, selected: layer }))
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }
  const onLayerPointerMove = (event: ReactPointerEvent) => {
    const layer = dragLayer.current
    const board = artboardRef.current
    if (!layer || !board) return
    const rect = board.getBoundingClientRect()
    setLayerPos(layer, {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 4, 96),
    })
  }
  const onLayerPointerUp = () => {
    dragLayer.current = null
  }

  const runExport = () => {
    manual({ exportState: 'running' })
    window.setTimeout(() => setScene((s) => ({ ...s, exportState: 'done' })), 900)
  }

  const layers: { id: DemoLayerId | 'background'; label: string }[] = [
    ...(scene.textChars > 0 ? [{ id: 'text' as const, label: typed }] : []),
    ...(scene.device ? [{ id: 'device' as const, label: t.demo.frame }] : []),
    { id: 'background' as const, label: t.demo.bgLayer },
  ]

  return (
    <div
      ref={containerRef}
      className="relative flex aspect-[16/10] w-full flex-col overflow-hidden rounded-lg bg-stage shadow-lg outline -outline-offset-1 outline-white/10 select-none"
    >
      <div
        onPointerDown={takeOver}
        className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/60 bg-background px-2.5"
      >
        <span aria-hidden className="mr-1 size-2 rounded-full bg-marker" />
        <ToolButton
          target="device-btn"
          active={scene.device}
          onClick={() => manual({ device: true, selected: 'device' })}
        >
          {t.demo.frame}
        </ToolButton>
        <ToolButton
          target="text-btn"
          active={scene.textChars > 0}
          onClick={() => manual({ textChars: typed.length, selected: 'text' })}
        >
          {t.demo.text}
        </ToolButton>
        <ToolButton
          target="apply-btn"
          active={scene.tiles > 0}
          onClick={() => manual({ tiles: 4 })}
        >
          {t.demo.apply}
        </ToolButton>
        <div className="ml-auto">
          <ToolButton target="export-btn" primary onClick={runExport}>
            {t.demo.export}
          </ToolButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Calques — le panneau gauche de l'app, réduit à sa liste. */}
        <aside
          onPointerDown={takeOver}
          className="hidden w-28 shrink-0 flex-col border-r border-border/60 bg-background md:flex"
        >
          <p className="border-b border-border/60 px-2.5 py-1.5 text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {t.demo.layers}
          </p>
          <div className="flex flex-col gap-px p-1">
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => manual({ selected: layer.id === 'background' ? null : layer.id })}
                className={cn(
                  'truncate rounded-xs px-1.5 py-1 text-left text-[10px] transition-colors duration-150',
                  layer.id !== 'background' && scene.selected === layer.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                {layer.label}
              </button>
            ))}
          </div>
        </aside>

        <div
          onPointerDown={takeOver}
          className="relative flex flex-1 items-center justify-center overflow-hidden [background-image:radial-gradient(var(--color-stage-dot)_1px,transparent_1px)] [background-size:12px_12px]"
        >
          <div
            ref={artboardRef}
            data-cursor-target="stage"
            className="relative h-[86%] overflow-hidden rounded-sm transition-[background] duration-500"
            style={{ aspectRatio: '1320 / 2868', background: DEMO_GRADIENTS[scene.bgIndex] }}
          >
            {scene.textChars > 0 ? (
              <p
                data-cursor-target="text-layer"
                onPointerDown={(event) => onLayerPointerDown(event, 'text')}
                onPointerMove={onLayerPointerMove}
                onPointerUp={onLayerPointerUp}
                className={cn(
                  'absolute w-[92%] -translate-x-1/2 -translate-y-1/2 cursor-grab text-center text-[clamp(8px,1vw,12px)] leading-tight font-bold text-white drop-shadow-[0_1px_2px_oklch(0_0_0/0.4)] active:cursor-grabbing',
                  scene.selected === 'text' && 'outline -outline-offset-2 outline-white/80',
                )}
                style={{ left: `${scene.textPos.x}%`, top: `${scene.textPos.y}%` }}
              >
                {typed.slice(0, Math.min(scene.textChars, typed.length))}
                {scene.textChars < typed.length ? (
                  <span
                    aria-hidden
                    className="ml-px inline-block h-[1em] w-px animate-pulse bg-white align-text-bottom"
                  />
                ) : null}
              </p>
            ) : null}
            {scene.device ? (
              <div
                onPointerDown={(event) => onLayerPointerDown(event, 'device')}
                onPointerMove={onLayerPointerMove}
                onPointerUp={onLayerPointerUp}
                className={cn(
                  'absolute h-[42%] w-max -translate-x-1/2 -translate-y-1/2 cursor-grab animate-in fade-in zoom-in-95 duration-300 active:cursor-grabbing',
                  scene.selected === 'device' && 'outline -outline-offset-2 outline-white/80',
                )}
                style={{ left: `${scene.devicePos.x}%`, top: `${scene.devicePos.y}%` }}
              >
                <div
                  className="relative h-full border-2 border-[#3A4B63] bg-black/25"
                  style={{ aspectRatio: '1170 / 2532', borderRadius: '16% / 8%' }}
                >
                  <span className="absolute top-[3%] left-1/2 h-[3.2%] w-[32%] -translate-x-1/2 rounded-full bg-black/70" />
                </div>
              </div>
            ) : null}
          </div>

          {scene.exportState !== 'idle' ? (
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-sm bg-card px-2.5 py-1.5 text-[10px] font-medium shadow-md">
              {scene.exportState === 'running' ? (
                <Loader2 aria-hidden className="size-3 animate-spin text-muted-foreground" />
              ) : (
                <Check aria-hidden className="size-3 text-marker" />
              )}
              <span className="tabular-nums">{t.demo.toast}</span>
            </div>
          ) : null}
        </div>

        {/* Propriétés — le panneau droit : fonds, puis la position du calque. */}
        <aside
          onPointerDown={takeOver}
          className="hidden w-32 shrink-0 flex-col border-l border-border/60 bg-background md:flex"
        >
          <p className="border-b border-border/60 px-2.5 py-1.5 text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {t.demo.properties}
          </p>
          <div className="flex flex-col gap-2.5 p-2.5">
            <div>
              <p className="text-[9px] text-muted-foreground">{t.demo.background}</p>
              <div data-cursor-target="bg-swatches" className="mt-1.5 flex gap-1.5">
                {DEMO_GRADIENTS.map((gradient, index) => (
                  <button
                    key={gradient}
                    type="button"
                    aria-label={`${t.demo.background} ${index + 1}`}
                    onClick={() => manual({ bgIndex: index })}
                    className={cn(
                      'size-5 rounded-xs transition-transform duration-150 hover:scale-110',
                      scene.bgIndex === index && 'ring-2 ring-marker',
                    )}
                    style={{ background: gradient }}
                  />
                ))}
              </div>
            </div>
            {scene.selected ? (
              <SelectedPosition selected={scene.selected} layerPos={layerPos} />
            ) : null}
          </div>
        </aside>
      </div>

      <div
        onPointerDown={takeOver}
        className="flex h-14 shrink-0 items-center justify-center gap-1.5 border-t border-border/60 px-2.5"
      >
        {[0, 1, 2, 3].map((tile) => (
          <div
            key={tile}
            className={cn(
              'h-9 overflow-hidden rounded-[3px] transition-[opacity,transform] duration-300',
              tile < scene.tiles ? 'opacity-100' : 'translate-y-0.5 opacity-25',
            )}
            style={{ aspectRatio: '1320 / 2868', background: DEMO_GRADIENTS[scene.bgIndex] }}
          >
            {tile < scene.tiles ? (
              <div className="flex h-full flex-col items-center pt-1">
                <span className="h-px w-2/3 bg-white/80" />
                <span className="mt-1 h-2 w-1/2 rounded-[1px] border border-[#3A4B63] bg-black/25" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <DemoCursor pose={cursor} visible={cursorOn && playing} />

      <div className="absolute right-2.5 bottom-[4.5rem] z-20">
        {playing ? (
          <button
            type="button"
            aria-label={t.demo.pause}
            onClick={(event) => {
              event.stopPropagation()
              takeOver()
            }}
            className="flex size-7 items-center justify-center rounded-sm bg-card text-muted-foreground shadow-md transition-colors duration-150 hover:text-foreground"
          >
            <Pause aria-hidden className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t.demo.replay}
            onClick={(event) => {
              event.stopPropagation()
              setTouched(false)
              setScene(EMPTY_SCENE)
              setAutoplay(true)
            }}
            className="flex size-7 items-center justify-center rounded-sm bg-card text-muted-foreground shadow-md transition-colors duration-150 hover:text-foreground"
          >
            <RotateCcw aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      {!playing ? (
        <p className="absolute bottom-[4.75rem] left-2.5 z-20 rounded-sm bg-card px-2 py-1 text-[10px] text-muted-foreground shadow-md">
          {t.demo.hint}
        </p>
      ) : null}
    </div>
  )
}
