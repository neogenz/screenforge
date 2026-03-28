import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { FontPicker } from './FontPicker'
import { loadGoogleFont } from '@/hooks/use-fonts'
import { inputCls, Field } from '@/components/properties-panel/TransformSection'
import { cn } from '@/lib/utils'
import type { TextLayer, GradientFill, TextShadow } from '@/types'

interface TextEditorProps {
  layer: TextLayer
}

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const TEXT_TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'] as const

export function TextEditor({ layer }: TextEditorProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)

  function update(patch: Partial<TextLayer>) {
    updateLayer(layer.id, patch as Partial<import('@/types').Layer>)
  }

  async function handleFontFamily(family: string) {
    await loadGoogleFont(family)
    update({ fontFamily: family })
  }

  function handleShadowToggle() {
    if (layer.shadow) {
      update({ shadow: undefined })
    } else {
      const shadow: TextShadow = { offsetX: 2, offsetY: 2, blur: 4, color: 'rgba(0,0,0,0.5)' }
      update({ shadow })
    }
  }

  function handleGradientToggle() {
    if (layer.gradientFill) {
      update({ gradientFill: undefined })
    } else {
      const gradient: GradientFill = {
        type: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: '#6366f1' },
          { offset: 1, color: '#8b5cf6' },
        ],
      }
      update({ gradientFill: gradient })
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Font family */}
      <Field label="Police">
        <FontPicker value={layer.fontFamily} onChange={handleFontFamily} />
      </Field>

      {/* Size + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Taille">
          <input
            type="number"
            min={8}
            max={200}
            value={layer.fontSize}
            onChange={(e) => update({ fontSize: parseInt(e.target.value, 10) || 16 })}
            className={inputCls}
            aria-label="Font size"
          />
        </Field>
        <Field label="Graisse">
          <select
            value={layer.fontWeight}
            onChange={(e) => update({ fontWeight: parseInt(e.target.value, 10) })}
            className={inputCls}
            aria-label="Font weight"
          >
            {FONT_WEIGHTS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Color */}
      <Field label="Couleur">
        <ColorPicker
          value={layer.color}
          onChange={(color) => update({ color })}
          showOpacity
        />
      </Field>

      {/* Alignment */}
      <Field label="Alignement">
        <div
          className="inline-flex gap-0.5 rounded-md border border-border bg-surface p-0.5"
          role="group"
          aria-label="Alignement du texte"
        >
          {(
            [
              { align: 'left', Icon: AlignLeft },
              { align: 'center', Icon: AlignCenter },
              { align: 'right', Icon: AlignRight },
            ] as const
          ).map(({ align, Icon }) => (
            <button
              key={align}
              type="button"
              onClick={() => update({ textAlign: align })}
              className={cn(
                'flex h-7 w-8 items-center justify-center rounded transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
                layer.textAlign === align
                  ? 'bg-panel text-primary shadow-sm ring-1 ring-border/60'
                  : 'text-muted hover:bg-surface-hover hover:text-foreground',
              )}
              aria-label={`Aligner ${align}`}
              aria-pressed={layer.textAlign === align}
            >
              <Icon size={14} strokeWidth={1.75} />
            </button>
          ))}
        </div>
      </Field>

      {/* Line height + Letter spacing */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Interligne">
          <input
            type="number"
            min={0.5}
            max={3}
            step={0.1}
            value={layer.lineHeight}
            onChange={(e) => update({ lineHeight: parseFloat(e.target.value) || 1.2 })}
            className={inputCls}
            aria-label="Line height"
          />
        </Field>
        <Field label="Approche">
          <input
            type="number"
            min={-5}
            max={20}
            step={0.5}
            value={layer.letterSpacing}
            onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) || 0 })}
            className={inputCls}
            aria-label="Letter spacing"
          />
        </Field>
      </div>

      {/* Text transform */}
      <Field label="Casse">
        <select
          value={layer.textTransform}
          onChange={(e) => update({ textTransform: e.target.value as TextLayer['textTransform'] })}
          className={inputCls}
          aria-label="Text transform"
        >
          {TEXT_TRANSFORMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>

      {/* Opacity */}
      <Field label="Opacité">
        <div className="flex h-7 items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={layer.opacity}
            onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
            className="min-h-5 flex-1 cursor-pointer accent-primary"
            aria-label="Opacité du calque"
          />
          <span className="w-8 shrink-0 text-right text-[10px] font-medium tabular-nums text-muted">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
      </Field>

      <div className="my-0.5 h-px bg-border/60" />

      {/* Text shadow */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">Ombre</span>
          <Toggle active={!!layer.shadow} onToggle={handleShadowToggle} />
        </div>
        {layer.shadow && (
          <div className="ml-0.5 flex flex-col gap-2 border-l-2 border-border/60 pl-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="X">
                <input
                  type="number"
                  value={layer.shadow.offsetX}
                  onChange={(e) =>
                    update({ shadow: { ...layer.shadow!, offsetX: parseInt(e.target.value, 10) || 0 } })
                  }
                  className={inputCls}
                  aria-label="Shadow offset X"
                />
              </Field>
              <Field label="Y">
                <input
                  type="number"
                  value={layer.shadow.offsetY}
                  onChange={(e) =>
                    update({ shadow: { ...layer.shadow!, offsetY: parseInt(e.target.value, 10) || 0 } })
                  }
                  className={inputCls}
                  aria-label="Shadow offset Y"
                />
              </Field>
            </div>
            <Field label="Blur">
              <input
                type="number"
                min={0}
                value={layer.shadow.blur}
                onChange={(e) =>
                  update({ shadow: { ...layer.shadow!, blur: parseInt(e.target.value, 10) || 0 } })
                }
                className={inputCls}
                aria-label="Shadow blur"
              />
            </Field>
            <Field label="Couleur">
              <ColorPicker
                value={layer.shadow.color}
                onChange={(color) =>
                  update({ shadow: { ...layer.shadow!, color } })
                }
                showOpacity
              />
            </Field>
          </div>
        )}
      </div>

      <div className="my-0.5 h-px bg-border/60" />

      {/* Gradient fill */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">Dégradé</span>
          <Toggle active={!!layer.gradientFill} onToggle={handleGradientToggle} />
        </div>
        {layer.gradientFill && (
          <GradientEditor
            value={layer.gradientFill}
            onChange={(gradientFill) => update({ gradientFill })}
          />
        )}
      </div>
    </div>
  )
}

// ─── Shared sub-components ──────────────────────────────────────────────────

interface ToggleProps {
  active: boolean
  onToggle: () => void
}

export function Toggle({ active, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      className={cn(
        'relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active ? 'bg-primary' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-150',
          active ? 'translate-x-[18px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
