import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { ShadowEditor } from '@/components/properties-panel/ShadowEditor'
import { PropertyRow } from '@/components/patterns/property-row'
import { SliderField } from '@/components/patterns/slider-field'
import { VectorPicker } from '@/components/vector-picker/VectorPicker'
import { ICON_CATALOG, ICON_STROKE, iconEntry, type IconId } from '@/lib/vector-catalog'
import type { IconLayer, Layer } from '@/types'

interface IconSectionProps {
  layer: IconLayer
}

/** Épaisseur maximale : au-delà, le trait ferme les contre-formes de l'icône. */
const MAX_ICON_STROKE = 4

export function IconSection({ layer }: IconSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)

  function update(patch: Partial<IconLayer>, options?: { coalesceKey?: string }) {
    updateLayer(layer.id, patch as Partial<Layer>, options)
  }

  /* Changer d'icône change aussi le nom du calque, tant que l'utilisateur ne
     l'a pas renommé : une liste de « Étoile » pour douze icônes différentes ne
     dit rien de la maquette. */
  function pick(iconId: IconId) {
    const next = iconEntry(iconId)
    const renamed = layer.name !== (iconEntry(layer.iconId)?.label ?? layer.name)
    update(renamed ? { iconId } : { iconId, name: next?.label ?? layer.name })
  }

  return (
    <div className="flex flex-col gap-2">
      <VectorPicker
        entries={ICON_CATALOG}
        value={layer.iconId}
        onChange={(iconId) => pick(iconId as IconId)}
        kind="icon"
        label="Icône"
        searchPlaceholder="Rechercher une icône…"
      />

      <PropertyRow label="Couleur" stacked>
        <ColorPicker
          value={layer.color}
          onChange={(color) => update({ color }, { coalesceKey: `layer:${layer.id}:color` })}
          showOpacity
        />
      </PropertyRow>

      <SliderField
        label="Épaisseur du trait"
        ariaLabel="Épaisseur du trait de l’icône"
        value={layer.strokeWidth ?? ICON_STROKE}
        min={0.5}
        max={MAX_ICON_STROKE}
        step={0.25}
        formatValue={(value: number) => value.toFixed(2).replace(/\.?0+$/, '')}
        onChange={(strokeWidth) =>
          update({ strokeWidth }, { coalesceKey: `layer:${layer.id}:strokeWidth` })
        }
      />

      {/* La bordure du panneau "Ombre" fait déjà le trait : pas de hairline en double. */}
      <ShadowEditor
        shadow={layer.shadow}
        onChange={(shadow, options) => update({ shadow }, options)}
        ariaLabel="Activer l’ombre"
        coalesceKey={`layer:${layer.id}:shadow`}
      />
    </div>
  )
}
