import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { Field } from './TransformSection'
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

  function numberInRange(raw: string, minimum: number, maximum: number, fallback: number) {
    const value = Number(raw)
    return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback
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
      <Field label="Type">
        <select
          value={layer.shapeType}
          onChange={(event) => update({ shapeType: event.target.value as ShapeLayer['shapeType'] })}
          className="input"
          aria-label="Type de forme"
        >
          <option value="rectangle">Rectangle</option>
          <option value="rounded-rect">Rectangle arrondi</option>
          <option value="circle">Cercle</option>
        </select>
      </Field>

      {/* Fill */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label-strong">Remplissage</span>
          <div className="flex items-center gap-2">
            <span className="mono-label">Dégradé</span>
            <Toggle label="Activer le dégradé" active={fillIsGradient} onToggle={handleGradientToggle} />
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

      <div className="hairline" />

      {/* Stroke */}
      <div className="flex flex-col gap-2">
        <span className="mono-label-strong">Contour</span>
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
            onChange={(e) => update({
              strokeWidth: numberInRange(e.target.value, 0, 100, layer.strokeWidth ?? 0),
            })}
            className="input"
            aria-label="Épaisseur du contour"
          />
        </Field>
      </div>

      {/* Border radius */}
      {layer.shapeType === 'rounded-rect' && (
        <>
          <div className="hairline" />
          <Field label="Rayon">
            <input
              type="number"
              min={0}
              value={layer.borderRadius ?? 8}
              onChange={(e) => update({
                borderRadius: numberInRange(e.target.value, 0, 1000, layer.borderRadius ?? 8),
              })}
              className="input"
              aria-label="Rayon des coins"
            />
          </Field>
        </>
      )}

      <div className="hairline" />

      {/* Shadow */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label-strong">Ombre</span>
          <Toggle label="Activer l’ombre" active={!!layer.shadow} onToggle={handleShadowToggle} />
        </div>
        {layer.shadow && (
          <div className="flex flex-col gap-2 pl-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="X">
                <input
                  type="number"
                  value={layer.shadow.offsetX}
                  onChange={(e) =>
                    update({ shadow: {
                      ...layer.shadow!,
                      offsetX: numberInRange(e.target.value, -200, 200, layer.shadow!.offsetX),
                    } })
                  }
                  className="input"
                  aria-label="Décalage X de l’ombre"
                />
              </Field>
              <Field label="Y">
                <input
                  type="number"
                  value={layer.shadow.offsetY}
                  onChange={(e) =>
                    update({ shadow: {
                      ...layer.shadow!,
                      offsetY: numberInRange(e.target.value, -200, 200, layer.shadow!.offsetY),
                    } })
                  }
                  className="input"
                  aria-label="Décalage Y de l’ombre"
                />
              </Field>
            </div>
            <Field label="Blur">
              <input
                type="number"
                min={0}
                value={layer.shadow.blur}
                onChange={(e) =>
                  update({ shadow: {
                    ...layer.shadow!,
                    blur: numberInRange(e.target.value, 0, 200, layer.shadow!.blur),
                  } })
                }
                className="input"
                aria-label="Flou de l’ombre"
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
