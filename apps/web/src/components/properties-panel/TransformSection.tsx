import { useState } from 'react'
import { CornerUpLeft, Link, Unlink } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { getDefaultDeviceSize } from '@/assets/device-frames'
import { clampLayerToBoard, layerOutOfReach } from '@/lib/canvas/canvas-utils'
import { getStoreTargetProfile } from '@/lib/dimensions'
import { useProjectStore } from '@/stores/project.store'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { AngleControl } from '@/components/patterns/angle-control'
import { IconButton } from '@/components/patterns/icon-button'
import { PropertyRow } from '@/components/patterns/property-row'
import { UnitField, UnitFieldPair } from '@/components/patterns/unit-field'
import type { Layer } from '@/types'

interface TransformSectionProps {
  layer: Layer
}

export function TransformSection({ layer }: TransformSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)
  const isDevice = layer.type === 'device-frame'
  const isOfficialBezel = isDevice && Boolean(layer.importedBezel)
  const isText = layer.type === 'text'
  const [lockAspectOverride, setLockAspect] = useState(false)
  // Device frames are official hardware — their aspect ratio is never unlocked.
  const lockAspect = isDevice || lockAspectOverride

  function update(patch: Partial<Layer>) {
    updateLayer(layer.id, patch, { coalesceKey: `layer:${layer.id}:transform` })
  }

  function handleX(x: number) {
    update({ x })
  }

  function handleY(y: number) {
    update({ y })
  }

  function handleWidth(width: number) {
    if (isDevice) {
      const ratio = layer.importedBezel
        ? layer.importedBezel.naturalWidth / layer.importedBezel.naturalHeight
        : getDefaultDeviceSize(layer.deviceModel).width /
          getDefaultDeviceSize(layer.deviceModel).height
      update({ width, height: Math.max(1, Math.round(width / ratio)) })
    } else if (!isText && lockAspect && layer.height > 0) {
      const ratio = layer.width / layer.height
      update({ width, height: Math.max(1, Math.round(width / ratio)) })
    } else {
      update({ width })
    }
  }

  function handleHeight(height: number) {
    // Text height is derived from content — never edited directly.
    if (isText) return

    if (isDevice) {
      const ratio = layer.importedBezel
        ? layer.importedBezel.naturalWidth / layer.importedBezel.naturalHeight
        : getDefaultDeviceSize(layer.deviceModel).width /
          getDefaultDeviceSize(layer.deviceModel).height
      update({ width: Math.max(1, Math.round(height * ratio)), height })
    } else if (lockAspect && layer.width > 0) {
      const ratio = layer.width / layer.height
      update({ width: Math.max(1, Math.round(height * ratio)), height })
    } else {
      update({ height })
    }
  }

  function handleRotation(value: number) {
    if (isOfficialBezel) return
    updateLayer(
      layer.id,
      { rotation: ((value % 360) + 360) % 360 },
      { coalesceKey: `layer:${layer.id}:rotation` },
    )
  }

  function handleOpacity(value: number) {
    if (isOfficialBezel) return
    updateLayer(
      layer.id,
      { opacity: Math.min(1, Math.max(0, Math.round(value) / 100)) },
      { coalesceKey: `layer:${layer.id}:opacity` },
    )
  }

  function resetSize() {
    if (layer.type === 'device-frame') {
      const canonical = getDefaultDeviceSize(layer.deviceModel)
      if (layer.importedBezel) {
        const longSide = Math.max(canonical.width, canonical.height)
        const ratio = layer.importedBezel.naturalWidth / layer.importedBezel.naturalHeight
        update(
          layer.importedBezel.naturalHeight >= layer.importedBezel.naturalWidth
            ? { width: Math.round(longSide * ratio), height: longSide }
            : { width: longSide, height: Math.round(longSide / ratio) },
        )
      } else update(canonical)
    } else if (layer.type === 'image') {
      const scale = Math.min(600 / layer.originalWidth, 600 / layer.originalHeight, 1)
      update({
        width: Math.max(1, Math.round(layer.originalWidth * scale)),
        height: Math.max(1, Math.round(layer.originalHeight * scale)),
      })
    }
  }

  /*
   * Le retour explicite quand le calque n'est plus saisissable sur sa planche.
   *
   * Hors de sa planche, il perd le clic et le lasso — c'est ce qui empêche un
   * calque devenu fantôme de voler le clic destiné à la planche voisine. Il
   * reste désignable depuis la liste des calques et récupérable en tirant son
   * fantôme depuis la scène vide. Le panneau garde cette issue directe pour un
   * calque parti hors du champ ou difficile à viser.
   */
  const target = useProjectStore((state) => state.project?.target ?? 'app-store-iphone')
  const board = getStoreTargetProfile(target).board
  const outOfReach = layerOutOfReach(layer, board)

  function bringBack() {
    update(clampLayerToBoard(layer, board))
  }

  return (
    <div className="flex flex-col gap-2">
      {outOfReach && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
          <p className="text-xs text-muted-foreground">
            Ce calque est sorti de la planche. L'export ne rend que ce qui est dessus.
          </p>
          <Button variant="outline" size="sm" onClick={bringBack} className="self-start">
            <CornerUpLeft size={12} strokeWidth={1.5} aria-hidden />
            Ramener sur la planche
          </Button>
        </div>
      )}

      {/* X / Y */}
      <UnitFieldPair
        fields={[
          { label: 'X', ariaLabel: 'Position X', value: Math.round(layer.x), onChange: handleX },
          { label: 'Y', ariaLabel: 'Position Y', value: Math.round(layer.y), onChange: handleY },
        ]}
      />

      {/* L / Lock / H — le verrou s'intercale entre les deux champs de la
          paire, `UnitFieldPair` ne réserve donc que la grille, pas le bouton. */}
      <div className="flex items-center gap-1.5">
        <UnitFieldPair
          className="flex-1"
          fields={[
            {
              label: 'L',
              ariaLabel: 'Largeur',
              min: 1,
              value: Math.round(layer.width),
              onChange: handleWidth,
            },
            {
              label: 'H',
              ariaLabel: 'Hauteur',
              min: 1,
              value: Math.round(layer.height),
              onChange: handleHeight,
              disabled: isText,
            },
          ]}
        />
        <IconButton
          size="sm"
          active={lockAspect}
          disabled={isText || isDevice}
          onClick={() => setLockAspect((v) => !v)}
          className="shrink-0"
          aria-label="Verrouiller les proportions"
          aria-pressed={lockAspect}
        >
          {lockAspect ? (
            <Link size={12} strokeWidth={1.5} aria-hidden />
          ) : (
            <Unlink size={12} strokeWidth={1.5} aria-hidden />
          )}
        </IconButton>
      </div>

      {/* Rotation */}
      <AngleControl
        label="Rotation"
        ariaLabel="Rotation"
        value={layer.rotation}
        onChange={handleRotation}
        disabled={isOfficialBezel}
      />

      {/* Opacity — glisse ou saisie, le champ reste éditable au clavier. */}
      <PropertyRow label="Opacité" stacked>
        <div className="flex h-8 items-center gap-2">
          <Slider
            value={Math.round(layer.opacity * 100)}
            onValueChange={(next) =>
              handleOpacity(typeof next === 'number' ? next : (next[0] ?? 0))
            }
            min={0}
            max={100}
            step={1}
            disabled={isOfficialBezel}
            // Voir `SliderField` : sans ça le curseur passe sous le champ.
            className="min-w-0 flex-1 *:data-[slot=slider-control]:min-w-0"
          />
          <UnitField
            ariaLabel="Opacité"
            value={Math.round(layer.opacity * 100)}
            onChange={handleOpacity}
            min={0}
            max={100}
            unit="%"
            disabled={isOfficialBezel}
            className="w-24 flex-none"
          />
        </div>
      </PropertyRow>

      {(isDevice || layer.type === 'image') && (
        <Button variant="ghost" size="sm" onClick={resetSize} className="self-start">
          Taille d'origine
        </Button>
      )}
    </div>
  )
}
