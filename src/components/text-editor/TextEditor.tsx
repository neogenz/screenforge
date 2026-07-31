import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { ShadowEditor } from '@/components/properties-panel/ShadowEditor'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_GRADIENT_FROM, DEFAULT_GRADIENT_TO } from '@/lib/content-defaults'
import { FontPicker } from './FontPicker'
import type { GradientFill, Layer, TextLayer } from '@/types'

interface TextEditorProps {
  layer: TextLayer
}

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900]

const DEFAULT_GRADIENT: GradientFill = {
  type: 'linear',
  angle: 90,
  stops: [
    { offset: 0, color: DEFAULT_GRADIENT_FROM },
    { offset: 1, color: DEFAULT_GRADIENT_TO },
  ],
}

const ALIGN_OPTIONS: SegmentedOption<TextLayer['textAlign']>[] = [
  { value: 'left', icon: <AlignLeft size={12} strokeWidth={1.5} aria-hidden />, ariaLabel: 'Aligner à gauche' },
  { value: 'center', icon: <AlignCenter size={12} strokeWidth={1.5} aria-hidden />, ariaLabel: 'Centrer' },
  { value: 'right', icon: <AlignRight size={12} strokeWidth={1.5} aria-hidden />, ariaLabel: 'Aligner à droite' },
]

// Segmented forces labels to uppercase — casing glyphs must keep their own
// case, so they ride the icon slot with the transform neutralized.
const CASING_OPTIONS: SegmentedOption<TextLayer['textTransform']>[] = [
  { value: 'none', icon: <CasingGlyph text="Aa" />, ariaLabel: 'Conserver la casse' },
  { value: 'uppercase', icon: <CasingGlyph text="AA" />, ariaLabel: 'Tout en majuscules' },
  { value: 'lowercase', icon: <CasingGlyph text="aa" />, ariaLabel: 'Tout en minuscules' },
  { value: 'capitalize', icon: <CasingGlyph text="Ab" />, ariaLabel: 'Majuscule à chaque mot' },
]

function CasingGlyph({ text }: { text: string }) {
  return (
    <span aria-hidden className="normal-case">
      {text}
    </span>
  )
}

export function TextEditor({ layer }: TextEditorProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)

  function update(patch: Partial<TextLayer>, options?: { coalesceKey?: string }) {
    updateLayer(layer.id, patch as Partial<Layer>, options)
  }

  // Keep legacy weights (pre-300–900 projects) selectable instead of blank.
  const weights = FONT_WEIGHTS.includes(layer.fontWeight)
    ? FONT_WEIGHTS
    : [...FONT_WEIGHTS, layer.fontWeight].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-3">
      <Field label="Contenu">
        <Textarea
          value={layer.content}
          onChange={(event) =>
            update({ content: event.target.value }, { coalesceKey: `layer:${layer.id}:content` })
          }
          className="h-20 resize-y"
          aria-label="Contenu du texte"
        />
      </Field>

      <Field label="Police">
        <FontPicker value={layer.fontFamily} onChange={(fontFamily) => update({ fontFamily })} />
      </Field>

      <NumberField
        label="Taille"
        ariaLabel="Taille de la police"
        value={layer.fontSize}
        onChange={(fontSize) => update({ fontSize }, { coalesceKey: `layer:${layer.id}:fontSize` })}
        min={1}
      />

      <Field label="Graisse">
        <Select
          value={layer.fontWeight}
          onChange={(event) => update({ fontWeight: Number(event.target.value) })}
          aria-label="Graisse de la police"
        >
          {weights.map((weight) => (
            <option key={weight} value={weight}>
              {weight}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Couleur">
        <ColorPicker
          value={layer.color}
          onChange={(color) => update({ color }, { coalesceKey: `layer:${layer.id}:color` })}
          showOpacity
        />
      </Field>

      <Field label="Alignement">
        <Segmented
          ariaLabel="Alignement"
          options={ALIGN_OPTIONS}
          value={layer.textAlign}
          onChange={(textAlign) => update({ textAlign })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Interligne"
          ariaLabel="Interligne"
          value={layer.lineHeight}
          onChange={(lineHeight) =>
            update({ lineHeight }, { coalesceKey: `layer:${layer.id}:lineHeight` })
          }
          step={0.1}
          precision={1}
          min={0.5}
          max={3}
        />
        <NumberField
          label="Espacement"
          ariaLabel="Espacement des lettres"
          value={layer.letterSpacing}
          onChange={(letterSpacing) =>
            update({ letterSpacing }, { coalesceKey: `layer:${layer.id}:letterSpacing` })
          }
          step={0.5}
          precision={1}
        />
      </div>

      <Field label="Casse">
        <Segmented
          ariaLabel="Casse"
          options={CASING_OPTIONS}
          value={layer.textTransform}
          onChange={(textTransform) => update({ textTransform })}
        />
      </Field>

      <div className="hairline my-1" />

      <ShadowEditor
        shadow={layer.shadow}
        onChange={(shadow, options) => update({ shadow }, options)}
        ariaLabel="Activer l’ombre du texte"
        coalesceKey={`layer:${layer.id}:shadow`}
      />

      <div className="hairline my-1" />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="caps-label-strong">Dégradé</span>
          <Switch
            ariaLabel="Activer le dégradé du texte"
            checked={!!layer.gradientFill}
            onChange={(checked) =>
              update({
                gradientFill: checked
                  ? { ...DEFAULT_GRADIENT, stops: DEFAULT_GRADIENT.stops.map((stop) => ({ ...stop })) }
                  : undefined,
              })
            }
          />
        </div>
        {layer.gradientFill && (
          <GradientEditor
            value={layer.gradientFill}
            onChange={(gradientFill) =>
              update({ gradientFill }, { coalesceKey: `layer:${layer.id}:gradient` })
            }
          />
        )}
      </div>
    </div>
  )
}
