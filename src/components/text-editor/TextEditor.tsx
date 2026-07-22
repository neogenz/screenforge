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
      <Field label="Font">
        <FontPicker value={layer.fontFamily} onChange={handleFontFamily} />
      </Field>

      {/* Size + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size">
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
        <Field label="Weight">
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
      <Field label="Color">
        <ColorPicker
          value={layer.color}
          onChange={(color) => update({ color })}
          showOpacity
        />
      </Field>

      {/* Alignment — flat segmented, monochrome */}
      <Field label="Align">
        <div className="seg" role="group" aria-label="Alignement du texte">
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
              data-active={layer.textAlign === align}
              className="seg-btn"
              aria-label={`Align ${align}`}
              aria-pressed={layer.textAlign === align}
            >
              <Icon size={12} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </Field>

      {/* Line height + Letter spacing */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Leading">
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
        <Field label="Tracking">
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
      <Field label="Case">
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
      <Field label="Opacity">
        <div className="flex h-7 items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={layer.opacity}
            onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
            className="min-h-5 flex-1 cursor-pointer"
            aria-label="Opacity"
          />
          <span className="mono-value w-8 shrink-0 text-right text-[10px] text-foreground-muted">
            {Math.round(layer.opacity * 100)}
          </span>
        </div>
      </Field>

      <div className="hairline my-1" />

      {/* Text shadow */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label-strong">Shadow</span>
          <Toggle active={!!layer.shadow} onToggle={handleShadowToggle} />
        </div>
        {layer.shadow && (
          <div className="flex flex-col gap-2 pl-3">
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
            <Field label="Color">
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

      <div className="hairline my-1" />

      {/* Gradient fill */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label-strong">Gradient</span>
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
        'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-100 ease-out',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
        active ? 'bg-foreground' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-panel transition-transform duration-100 ease-out',
          active ? 'translate-x-[12px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
