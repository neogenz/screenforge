import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { ShadowEditor } from '@/components/properties-panel/ShadowEditor'
import { PanelSection } from '@/components/patterns/panel-section'
import { PropertyRow } from '@/components/patterns/property-row'
import { UnitField } from '@/components/patterns/unit-field'
import { Segmented } from '@/components/patterns/segmented'
import type { SegmentedOption } from '@/components/patterns/segmented'
import { SelectField } from '@/components/patterns/select-field'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_GRADIENT_FROM, DEFAULT_GRADIENT_TO } from '@/lib/content-defaults'
import { FONT_WEIGHT_OPTIONS } from '@/lib/fonts'
import { textColorEdit, textColorValue } from '@/lib/text-styles'
import { FontPicker } from './FontPicker'
import type { GradientFill, Layer, TextLayer } from '@/types'

interface TextEditorProps {
  layer: TextLayer
}

const DEFAULT_GRADIENT: GradientFill = {
  type: 'linear',
  angle: 90,
  stops: [
    { offset: 0, color: DEFAULT_GRADIENT_FROM },
    { offset: 1, color: DEFAULT_GRADIENT_TO },
  ],
}

const ALIGN_OPTIONS: SegmentedOption<TextLayer['textAlign']>[] = [
  {
    value: 'left',
    icon: <AlignLeft size={12} strokeWidth={1.5} aria-hidden />,
    ariaLabel: 'Aligner à gauche',
  },
  {
    value: 'center',
    icon: <AlignCenter size={12} strokeWidth={1.5} aria-hidden />,
    ariaLabel: 'Centrer',
  },
  {
    value: 'right',
    icon: <AlignRight size={12} strokeWidth={1.5} aria-hidden />,
    ariaLabel: 'Aligner à droite',
  },
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
  // Le passage surligné sur la planche, s'il appartient bien à ce calque.
  const textRange = useCanvasStore((s) => s.textRange)
  const range = textRange?.layerId === layer.id ? textRange : null

  function update(patch: Partial<TextLayer>, options?: { coalesceKey?: string }) {
    updateLayer(layer.id, patch as Partial<Layer>, options)
  }

  // Keep legacy weights (pre-300–900 projects) selectable instead of blank.
  const weights = FONT_WEIGHT_OPTIONS.some((option) => option.value === layer.fontWeight)
    ? FONT_WEIGHT_OPTIONS
    : [...FONT_WEIGHT_OPTIONS, { value: layer.fontWeight, label: String(layer.fontWeight) }].sort(
        (a, b) => a.value - b.value,
      )

  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label="Contenu" stacked>
        <Textarea
          value={layer.content}
          onChange={(event) =>
            update({ content: event.target.value }, { coalesceKey: `layer:${layer.id}:content` })
          }
          className="h-20 resize-y"
          aria-label="Contenu du texte"
        />
      </PropertyRow>

      <FontPicker
        label="Police"
        value={layer.fontFamily}
        onChange={(fontFamily) => update({ fontFamily })}
      />

      <UnitField
        label="Taille"
        ariaLabel="Taille de la police"
        value={layer.fontSize}
        onChange={(fontSize) => update({ fontSize }, { coalesceKey: `layer:${layer.id}:fontSize` })}
        min={1}
      />

      <SelectField
        label="Graisse"
        value={String(layer.fontWeight)}
        onValueChange={(next) => update({ fontWeight: Number(next) })}
        aria-label="Graisse de la police"
        items={weights.map((weight) => ({ value: String(weight.value), label: weight.label }))}
      />

      {/* Un seul contrôle pour deux portées : tant que rien n'est surligné sur
          la planche, il peint le calque ; dès qu'un passage l'est, il ne peint
          que lui. Deux champs côte à côte auraient demandé à l'utilisateur de
          choisir la portée *avant* la couleur, alors que sa sélection l'a déjà
          dite — et le second serait resté grisé les neuf dixièmes du temps. */}
      {/* Le `description` de `PropertyRow` porte la même note : il vit dans le
          `Field`, au même écart que celui qui lie déjà l'étiquette à son
          contrôle — pas une marge négative posée après coup. */}
      <PropertyRow
        label={range ? 'Couleur du passage' : 'Couleur'}
        stacked
        description={
          range ? 'Repeindre le passage avec la couleur du calque le rend à celui-ci.' : undefined
        }
      >
        <ColorPicker
          value={textColorValue(layer, range)}
          onChange={(color) => {
            const edit = textColorEdit(layer, range, color)
            update(edit.updates, { coalesceKey: edit.coalesceKey })
          }}
          showOpacity
        />
      </PropertyRow>

      <PropertyRow label="Alignement" stacked>
        <Segmented
          ariaLabel="Alignement"
          options={ALIGN_OPTIONS}
          value={layer.textAlign}
          onChange={(textAlign) => update({ textAlign })}
        />
      </PropertyRow>

      <div className="grid grid-cols-2 gap-2">
        <UnitField
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
        <UnitField
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

      <PropertyRow label="Casse" stacked>
        <Segmented
          ariaLabel="Casse"
          options={CASING_OPTIONS}
          value={layer.textTransform}
          onChange={(textTransform) => update({ textTransform })}
        />
      </PropertyRow>

      {/* La bordure du panneau qui suit fait déjà le trait : pas de hairline en double. */}
      <ShadowEditor
        shadow={layer.shadow}
        onChange={(shadow, options) => update({ shadow }, options)}
        ariaLabel="Activer l’ombre du texte"
        coalesceKey={`layer:${layer.id}:shadow`}
      />

      <PanelSection
        title="Dégradé"
        headerExtra={
          <Switch
            aria-label="Activer le dégradé du texte"
            checked={!!layer.gradientFill}
            onCheckedChange={(checked) =>
              update({
                gradientFill: checked
                  ? {
                      ...DEFAULT_GRADIENT,
                      stops: DEFAULT_GRADIENT.stops.map((stop) => ({ ...stop })),
                    }
                  : undefined,
              })
            }
          />
        }
      >
        {layer.gradientFill && (
          <GradientEditor
            value={layer.gradientFill}
            onChange={(gradientFill, coalesceKey) =>
              update(
                { gradientFill },
                coalesceKey
                  ? { coalesceKey: `layer:${layer.id}:gradient:${coalesceKey}` }
                  : undefined,
              )
            }
          />
        )}
      </PanelSection>
    </div>
  )
}
