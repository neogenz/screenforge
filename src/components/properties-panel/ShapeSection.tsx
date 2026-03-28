import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { inputCls, Field } from './TransformSection'
import { Toggle } from '@/components/text-editor/TextEditor'
import type { ShapeLayer, GradientFill, TextShadow } from '@/types'

interface ShapeSectionProps {
  layer: ShapeLayer
}

export function ShapeSection({ layer }: ShapeSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)

  function update(patch: Partial<ShapeLayer>) {
    updateLayer(layer.id, patch as Partial<import('@/types').Layer>)
  }

  const fillIsGradient = typeof layer.fill !== 'string'
  const fillColor = typeof layer.fill === 'string' ? layer.fill : '#6366f1'

  function handleGradientToggle() {
    if (fillIsGradient) {
      update({ fill: fillColor })
    } else {
      const gradient: GradientFill = {
        type: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: '#6366f1' },
          { offset: 1, color: '#8b5cf6' },
        ],
      }
      update({ fill: gradient })
    }
  }

  function handleShadowToggle() {
    if (layer.shadow) {
      update({ shadow: undefined })
    } else {
      const shadow: TextShadow = { offsetX: 4, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.3)' }
      update({ shadow })
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Fill */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">Remplissage</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted">Dégradé</span>
            <Toggle active={fillIsGradient} onToggle={handleGradientToggle} />
          </div>
        </div>
        {fillIsGradient ? (
          <GradientEditor
            value={layer.fill as GradientFill}
            onChange={(fill) => update({ fill })}
          />
        ) : (
          <ColorPicker
            value={fillColor}
            onChange={(fill) => update({ fill })}
            showOpacity
          />
        )}
      </div>

      <div className="h-px bg-border/60" />

      {/* Stroke */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium text-foreground">Contour</span>
        <Field label="Couleur">
          <ColorPicker
            value={layer.stroke ?? '#000000'}
            onChange={(stroke) => update({ stroke })}
          />
        </Field>
        <Field label="Épaisseur">
          <input
            type="number"
            min={0}
            value={layer.strokeWidth ?? 0}
            onChange={(e) => update({ strokeWidth: parseInt(e.target.value, 10) || 0 })}
            className={inputCls}
            aria-label="Stroke width"
          />
        </Field>
      </div>

      {/* Border radius */}
      {layer.shapeType === 'rounded-rect' && (
        <>
          <div className="h-px bg-border/60" />
          <Field label="Rayon">
            <input
              type="number"
              min={0}
              value={layer.borderRadius ?? 8}
              onChange={(e) => update({ borderRadius: parseInt(e.target.value, 10) || 0 })}
              className={inputCls}
              aria-label="Border radius"
            />
          </Field>
        </>
      )}

      <div className="h-px bg-border/60" />

      {/* Shadow */}
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
                  aria-label="Shadow X offset"
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
                  aria-label="Shadow Y offset"
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
                onChange={(color) => update({ shadow: { ...layer.shadow!, color } })}
                showOpacity
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}
