import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { ShadowEditor } from '@/components/properties-panel/ShadowEditor'
import { Field, FieldLabel } from '@/components/ui/field'
import { UnitField } from '@/components/patterns/unit-field'
import { Switch } from '@/components/ui/switch'
import { VectorPicker } from '@/components/vector-picker/VectorPicker'
import { SHAPE_CATALOG, type ShapeId } from '@/lib/vector-catalog'
import {
  DEFAULT_GRADIENT_FROM,
  DEFAULT_GRADIENT_TO,
  DEFAULT_STROKE_COLOR,
} from '@/lib/content-defaults'
import type { GradientFill, Layer, ShapeLayer } from '@/types'

interface ShapeSectionProps {
  layer: ShapeLayer
}

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
      <VectorPicker
        entries={SHAPE_CATALOG}
        value={layer.shapeType}
        onChange={(shapeType) => update({ shapeType: shapeType as ShapeId })}
        kind="shape"
        label="Forme"
        searchPlaceholder="Rechercher une forme…"
      />

      {/* Fill */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Remplissage</h3>
          <div className="flex items-center gap-2">
            <span className="field-label">Dégradé</span>
            <Switch
              aria-label="Activer le dégradé"
              checked={fillIsGradient}
              onCheckedChange={handleGradientToggle}
            />
          </div>
        </div>
        {fillIsGradient ? (
          <GradientEditor
            value={layer.fill as GradientFill}
            onChange={(fill, coalesceKey) =>
              update(
                { fill },
                coalesceKey ? { coalesceKey: `layer:${layer.id}:fill:${coalesceKey}` } : undefined,
              )
            }
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
          <UnitField
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
        <h3 className="section-title">Contour</h3>
        <Field className="gap-1.5">
          <FieldLabel>Couleur</FieldLabel>
          <ColorPicker
            value={layer.stroke ?? DEFAULT_STROKE_COLOR}
            onChange={(stroke) => update({ stroke }, { coalesceKey: `layer:${layer.id}:stroke` })}
          />
        </Field>
        <UnitField
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
