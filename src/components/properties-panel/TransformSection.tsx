import { useState } from 'react'
import { Link2, Unlink2 } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { cn } from '@/lib/utils'
import type { Layer } from '@/types'

interface TransformSectionProps {
  layer: Layer
}

const inputCls = 'input'

function finiteNumber(raw: string, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

export function TransformSection({ layer }: TransformSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)
  const [lockAspect, setLockAspect] = useState(false)

  function update(patch: Partial<Layer>) {
    updateLayer(layer.id, patch)
  }

  function handleWidth(raw: string) {
    const w = Math.max(1, finiteNumber(raw, layer.width))
    if (layer.type !== 'text' && lockAspect && layer.height > 0) {
      const ratio = layer.width / layer.height
      update({ width: w, height: Math.round(w / ratio) })
    } else {
      update({ width: w })
    }
  }

  function handleHeight(raw: string) {
    if (layer.type === 'text') return

    const h = Math.max(1, finiteNumber(raw, layer.height))
    if (lockAspect && layer.width > 0) {
      const ratio = layer.width / layer.height
      update({ width: Math.round(h * ratio), height: h })
    } else {
      update({ height: h })
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* X / Y */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <input
            type="number"
            value={Math.round(layer.x)}
            onChange={(e) => update({ x: finiteNumber(e.target.value, layer.x) })}
            className={inputCls}
            aria-label="X position"
          />
        </Field>
        <Field label="Y">
          <input
            type="number"
            value={Math.round(layer.y)}
            onChange={(e) => update({ y: finiteNumber(e.target.value, layer.y) })}
            className={inputCls}
            aria-label="Y position"
          />
        </Field>
      </div>

      {/* W / Lock / H */}
      <div className="flex items-end gap-1.5">
        <Field label="W" className="min-w-0 flex-1">
          <input
            type="number"
            min={1}
            value={Math.round(layer.width)}
            onChange={(e) => handleWidth(e.target.value)}
            className={inputCls}
            aria-label="Width"
          />
        </Field>
        <button
          type="button"
          onClick={() => setLockAspect((v) => !v)}
          disabled={layer.type === 'text'}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-100 ease-out',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
            layer.type === 'text' && 'cursor-not-allowed opacity-40',
            lockAspect
              ? 'border-foreground-muted bg-surface-active text-foreground'
              : 'border-border bg-panel text-muted hover:border-border-strong hover:text-foreground',
          )}
          aria-label={layer.type === 'text' ? 'Text height is automatic' : lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
          aria-pressed={lockAspect}
        >
          {lockAspect ? <Link2 size={12} strokeWidth={1.5} /> : <Unlink2 size={12} strokeWidth={1.5} />}
        </button>
        <Field label="H" className="min-w-0 flex-1">
          {layer.type === 'text' ? (
            <input
              type="text"
              value="Auto"
              disabled
              className={cn(inputCls, 'cursor-not-allowed text-muted')}
              aria-label="Text height (automatic)"
            />
          ) : (
            <input
              type="number"
              min={1}
              value={Math.round(layer.height)}
              onChange={(e) => handleHeight(e.target.value)}
              className={inputCls}
              aria-label="Height"
            />
          )}
        </Field>
      </div>

      {/* Rotation / Opacity */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Rot">
          <div className="relative">
            <input
              type="number"
              min={0}
              max={360}
              value={Math.round(layer.rotation)}
              onChange={(e) => {
                const rotation = finiteNumber(e.target.value, layer.rotation)
                update({ rotation: ((rotation % 360) + 360) % 360 })
              }}
              className={cn(inputCls, 'pr-6')}
              aria-label="Rotation in degrees"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted">
              °
            </span>
          </div>
        </Field>
        <Field label="Opacity">
          <div className="flex h-7 items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={layer.opacity}
              onChange={(e) => update({ opacity: Math.min(1, Math.max(0, finiteNumber(e.target.value, layer.opacity))) })}
              className="min-h-5 flex-1 cursor-pointer"
              aria-label="Opacity"
            />
            <span className="mono-value w-8 shrink-0 text-right text-[10px] text-foreground-muted">
              {Math.round(layer.opacity * 100)}
            </span>
          </div>
        </Field>
      </div>
    </div>
  )
}

// Shared input class — flat, hairline border, mono numerics
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="mono-label">{label}</span>
      {children}
    </div>
  )
}
