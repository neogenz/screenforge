import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { ShadowEditor } from '@/components/properties-panel/ShadowEditor'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_GRADIENT_FROM, DEFAULT_GRADIENT_TO, DEFAULT_STROKE_COLOR } from '@/lib/content-defaults'
import type { GradientFill, Layer, ShapeLayer } from '@/types'

interface ShapeSectionProps {
  layer: ShapeLayer
}

const SHAPE_TYPE_OPTIONS: SegmentedOption<ShapeLayer['shapeType']>[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Cercle' },
  { value: 'rounded-rect', label: 'Arrondi' },
]

export function ShapeSection({ layer }: ShapeSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)

  function update(patch: Partial<ShapeLayer>, options?: { coalesceKey?: string }) {
    updateLayer(layer.id, patch as Partial<Layer>, options)
  }

  const fillIsGradient = typeof layer.fill !== 'string'
  const fillColor = typeof layer.fill === 'string' ? layer.fill : DEFAULT_GRADIENT_FROM

  function handleGradientToggle(gradientOn: boolean) {
    if (gradientOn) {
      const gradient: GradientFill = {
        type: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: DEFAULT_GRADIENT_FROM },
          { offset: 1, color: DEFAULT_GRADIENT_TO },
        ],
      }
      update({ fill: gradient })
    } else {
      update({ fill: fillColor })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Segmented
        options={SHAPE_TYPE_OPTIONS}
        value={layer.shapeType}
        onChange={(shapeType) => update({ shapeType })}
        ariaLabel="Type de forme"
        className="w-full"
      />

      {/* Fill */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="section-title">Remplissage</span>
          <div className="flex items-center gap-2">
            <span className="field-label">Dégradé</span>
            <Switch ariaLabel="Activer le dégradé" checked={fillIsGradient} onChange={handleGradientToggle} />
          </div>
        </div>
        {fillIsGradient ? (
          <GradientEditor
            value={layer.fill as GradientFill}
            onChange={(fill, coalesceKey) => update(
              { fill },
              coalesceKey ? { coalesceKey: `layer:${layer.id}:fill:${coalesceKey}` } : undefined,
            )}
          />
        ) : (
          <ColorPicker
            value={fillColor}
            onChange={(fill) => update({ fill }, { coalesceKey: `layer:${layer.id}:fill` })}
            showOpacity
          />
        )}
      </div>

      {/* Border radius — rounded-rect only */}
      {layer.shapeType === 'rounded-rect' && (
        <>
          <div className="hairline" />
          <NumberField
            label="Rayon"
            ariaLabel="Rayon des coins"
            value={layer.borderRadius ?? 8}
            onChange={(borderRadius) =>
              update({ borderRadius }, { coalesceKey: `layer:${layer.id}:borderRadius` })
            }
            min={0}
          />
        </>
      )}

      <div className="hairline" />

      {/* Stroke */}
      <div className="flex flex-col gap-2">
        <span className="section-title">Contour</span>
        <Field label="Couleur">
          <ColorPicker
            value={layer.stroke ?? DEFAULT_STROKE_COLOR}
            onChange={(stroke) => update({ stroke }, { coalesceKey: `layer:${layer.id}:stroke` })}
          />
        </Field>
        <NumberField
          label="Épaisseur"
          ariaLabel="Épaisseur du contour"
          value={layer.strokeWidth ?? 0}
          onChange={(strokeWidth) =>
            update({ strokeWidth }, { coalesceKey: `layer:${layer.id}:strokeWidth` })
          }
          min={0}
          max={100}
        />
      </div>

      <div className="hairline" />

      <ShadowEditor
        shadow={layer.shadow}
        onChange={(shadow, options) => update({ shadow }, options)}
        ariaLabel="Activer l’ombre"
        coalesceKey={`layer:${layer.id}:shadow`}
      />
    </div>
  )
}
