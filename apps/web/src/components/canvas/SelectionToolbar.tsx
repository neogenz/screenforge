import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  Copy,
  ImagePlus,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { FontPicker } from '@/components/text-editor/FontPicker'
import { IconButton } from '@/components/ui/icon-button'
import { NumberField } from '@/components/ui/number-field'
import { Popover } from '@/components/ui/popover'
import { SwatchButton } from '@/components/ui/swatch-button'
import { getDeviceFrame } from '@/assets/device-frames'
import { registerAsset } from '@/lib/assets'
import {
  imageImportErrorMessage,
  importImageFile,
  SCREENSHOT_IMAGE_ACCEPT,
  SCREENSHOT_IMAGE_TYPES,
} from '@/lib/image'
import { textColorEdit, textColorValue } from '@/lib/text-styles'
import { toast } from '@/stores/toast.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import type { SelectionFrame } from '@/hooks/use-canvas'
import type { AlignMode } from '@/lib/align'
import type { Layer, ScreenshotSize, TextLayer } from '@/types'

/**
 * Hauteur fixe de la barre : évite de la mesurer pour décider du basculement.
 *
 * 46 = contrôles de 32 + le retrait d'îlot (2×6) + son filet (2×1). La barre ne
 * pose plus sa propre géométrie : elle prend celle que `.island` donne à toutes
 * les autres, et cette constante ne fait que la répéter au calcul de position.
 */
const BAR_HEIGHT = 46
/** Écart entre la sélection et la barre. */
const OFFSET = 10
/** Marge minimale conservée contre les bords du stage. */
const EDGE = 12

const ALIGNMENTS: { mode: AlignMode; icon: LucideIcon; label: string }[] = [
  { mode: 'left', icon: AlignStartVertical, label: 'Aligner à gauche' },
  { mode: 'center-x', icon: AlignCenterVertical, label: 'Centrer horizontalement' },
  { mode: 'right', icon: AlignEndVertical, label: 'Aligner à droite' },
  { mode: 'top', icon: AlignStartHorizontal, label: 'Aligner en haut' },
  { mode: 'center-y', icon: AlignCenterHorizontal, label: 'Centrer verticalement' },
  { mode: 'bottom', icon: AlignEndHorizontal, label: 'Aligner en bas' },
]

/**
 * En icônes et non en mots : « Gauche Centre Droite » était le seul bloc de
 * texte de la barre, il en faisait un tiers de la largeur, et son groupe
 * segmenté montait à 38 px dans une barre qui n'en fait pas 40. Les glyphes de
 * paragraphe ne se confondent pas avec les icônes d'alignement d'objet, qui
 * figurent des bords, pas des lignes de texte.
 */
const TEXT_ALIGNMENTS: { value: TextLayer['textAlign']; icon: LucideIcon; label: string }[] = [
  { value: 'left', icon: AlignLeft, label: 'Texte à gauche' },
  { value: 'center', icon: AlignCenter, label: 'Texte centré' },
  { value: 'right', icon: AlignRight, label: 'Texte à droite' },
]

interface SelectionToolbarProps {
  frame: SelectionFrame | null
}

/**
 * Barre contextuelle posée sous la sélection.
 *
 * Elle n'existe que drawer Propriétés fermé. Ouvert, il porte déjà les mêmes
 * réglages, et entretenir deux surfaces concurrentes est le plus sûr moyen de
 * les voir diverger. C'est aussi ce qui justifie qu'elle existe : le stage est
 * maximal et les drawers rétractables, sans elle la moindre retouche coûte une
 * réouverture de panneau.
 */
export function SelectionToolbar({ frame }: SelectionToolbarProps) {
  const propsOpen = useUIStore((state) => state.propsOpen)
  const layers = useProjectStore(
    useShallow((state) =>
      state.project
        ? [
            ...state.project.screens.flatMap((screen) => screen.layers),
            ...state.project.layoutLayers,
          ]
        : [],
    ),
  )
  const selectedLayerIds = useCanvasStore((state) => state.selectedLayerIds)
  const screens = useProjectStore((state) => state.project?.screens)

  if (propsOpen || !frame || selectedLayerIds.length === 0) return null
  const selected = layers.filter((layer) => selectedLayerIds.includes(layer.id))
  if (selected.length === 0) return null
  const allText = selected.every((layer) => layer.type === 'text')
  const crossScreen =
    (screens?.filter((screen) => screen.layers.some((layer) => selectedLayerIds.includes(layer.id)))
      .length ?? 0) > 1

  // Sous la sélection par défaut ; au-dessus quand le bas du stage n'a plus la
  // place, ce qui arrive dès qu'on travaille sur le bas d'un artboard.
  const below = frame.top + frame.height + OFFSET
  const flipped = below + BAR_HEIGHT + EDGE > frame.stageHeight
  const top = flipped ? Math.max(EDGE, frame.top - OFFSET - BAR_HEIGHT) : below

  return (
    <div
      className="island animate-fade-in pointer-events-auto absolute z-(--z-chrome)
        flex max-w-[min(680px,calc(100%-24px))] items-center gap-1 overflow-x-auto"
      role="toolbar"
      aria-label="Actions de la sélection"
      style={{
        top,
        left: Math.round(frame.left + frame.width / 2),
        // La translation garde la barre centrée sans dépendre de sa largeur,
        // et `max-inline-size` plus la marge la retiennent dans le stage.
        transform: 'translateX(-50%)',
        maxWidth: Math.max(240, frame.stageWidth - EDGE * 2),
      }}
    >
      {!crossScreen && (
        <>
          {ALIGNMENTS.map(({ mode, icon: Icon, label }) => (
            <IconButton
              key={mode}
              size="sm"
              aria-label={label}
              title={label}
              onClick={() => useCanvasStore.getState().alignSelection(mode)}
            >
              <Icon size={14} strokeWidth={1.6} aria-hidden />
            </IconButton>
          ))}
          <Divider />
        </>
      )}
      {selected.length === 1 ? (
        <LayerControls layer={selected[0]} layerIds={selectedLayerIds} />
      ) : allText ? (
        <>
          <MultiCount count={selected.length} />
          <Divider />
          <LayerControls layer={selected[0]} layerIds={selectedLayerIds} />
        </>
      ) : (
        <MultiCount count={selected.length} />
      )}
      {!crossScreen && (
        <>
          <Divider />
          <IconButton
            size="sm"
            aria-label="Dupliquer"
            title="Dupliquer"
            onClick={() => {
              for (const id of selectedLayerIds) useCanvasStore.getState().duplicateLayer(id)
            }}
          >
            <Copy size={14} strokeWidth={1.6} aria-hidden />
          </IconButton>
          <IconButton
            size="sm"
            aria-label="Supprimer"
            title="Supprimer"
            className="hover:text-destructive"
            onClick={() => {
              for (const id of selectedLayerIds) useCanvasStore.getState().removeLayer(id)
            }}
          >
            <Trash2 size={14} strokeWidth={1.6} aria-hidden />
          </IconButton>
        </>
      )}
    </div>
  )
}

/**
 * Le trait sépare des groupes, pas des boutons : il lui faut plus d'air que
 * l'écart courant, sinon la barre se lit comme une seule file d'icônes. 2 px de
 * marge s'ajoutent aux 4 px du `gap` — 6 de chaque côté contre 4 entre voisins.
 */
function Divider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
}

function MultiCount({ count }: { count: number }) {
  return (
    <span className="field-label tabular shrink-0 whitespace-nowrap px-1.5">{count} calques</span>
  )
}

/** Les réglages les plus utilisés du type sélectionné, jamais l'inventaire complet. */
function LayerControls({ layer, layerIds }: { layer: Layer; layerIds: string[] }) {
  const textRange = useCanvasStore((state) => state.textRange)
  const multiple = layerIds.length > 1
  const update = (updates: Partial<Layer>, coalesceKey?: string) => {
    const store = useCanvasStore.getState()
    if (!multiple) {
      store.updateLayer(layer.id, updates, coalesceKey ? { coalesceKey } : undefined)
      return
    }
    const selectionKey = `selection:${[...layerIds].sort().join(',')}`
    store.updateSelectedLayers(updates, {
      coalesceKey: coalesceKey?.replace(`layer:${layer.id}`, selectionKey),
    })
  }

  if (layer.type === 'text') {
    return (
      <>
        <div className="w-28 shrink-0">
          <FontPicker
            value={layer.fontFamily}
            onChange={(fontFamily) => update({ fontFamily } as Partial<Layer>)}
          />
        </div>
        <div className="w-[68px] shrink-0">
          <NumberField
            ariaLabel="Taille du texte"
            value={layer.fontSize}
            min={8}
            max={400}
            onChange={(fontSize) =>
              update({ fontSize } as Partial<Layer>, `layer:${layer.id}:fontSize`)
            }
          />
        </div>
        {/* Même portée que dans le panneau, et pour la même raison : la barre
            et le panneau ne sont jamais visibles ensemble, mais ils doivent
            faire la même chose. `textColorEdit` est l'endroit qui le décide. */}
        <ColorControl
          label={
            !multiple && textRange?.layerId === layer.id ? 'Couleur du passage' : 'Couleur du texte'
          }
          value={textColorValue(layer, multiple ? null : textRange)}
          onChange={(color) => {
            const edit = textColorEdit(layer, multiple ? null : textRange, color)
            update(edit.updates as Partial<Layer>, edit.coalesceKey)
          }}
        />
        {TEXT_ALIGNMENTS.map(({ value, icon: Icon, label }) => (
          <IconButton
            key={value}
            size="sm"
            active={layer.textAlign === value}
            aria-label={label}
            title={label}
            onClick={() => update({ textAlign: value } as Partial<Layer>)}
          >
            <Icon size={14} strokeWidth={1.6} aria-hidden />
          </IconButton>
        ))}
      </>
    )
  }

  if (layer.type === 'device-frame') {
    if (layer.importedBezel) {
      return (
        <>
          <span className="field-label max-w-44 shrink truncate px-1">
            {layer.importedBezel.fileName}
          </span>
          <ScreenshotButton
            onPick={(screenshotAssetId, screenshotSize) =>
              update({ screenshotAssetId, screenshotSize } as Partial<Layer>)
            }
          />
        </>
      )
    }
    const colors = getDeviceFrame(layer.deviceModel).colors
    return (
      <>
        <span className="field-label shrink-0 whitespace-nowrap px-1">
          {getDeviceFrame(layer.deviceModel).modelName}
        </span>
        <ScreenshotButton
          onPick={(screenshotAssetId, screenshotSize) =>
            update({ screenshotAssetId, screenshotSize } as Partial<Layer>)
          }
        />
        {colors.map((color) => (
          <SwatchButton
            key={color.name}
            className="size-8"
            color={color.frame}
            selected={color.name === layer.deviceColor}
            aria-label={color.label}
            title={color.label}
            onClick={() => update({ deviceColor: color.name } as Partial<Layer>)}
          />
        ))}
      </>
    )
  }

  if (layer.type === 'icon') {
    return (
      <ColorControl
        label="Couleur"
        value={layer.color}
        onChange={(color) => update({ color } as Partial<Layer>, `layer:${layer.id}:color`)}
      />
    )
  }

  if (layer.type === 'shape') {
    return (
      <>
        {typeof layer.fill === 'string' && (
          <ColorControl
            label="Remplissage"
            value={layer.fill}
            onChange={(fill) => update({ fill } as Partial<Layer>, `layer:${layer.id}:fill`)}
          />
        )}
        {layer.shapeType === 'rounded-rect' && (
          <div className="w-20 shrink-0">
            <NumberField
              label="Rayon"
              ariaLabel="Rayon des angles"
              value={layer.borderRadius ?? 0}
              min={0}
              max={400}
              onChange={(borderRadius) =>
                update({ borderRadius } as Partial<Layer>, `layer:${layer.id}:borderRadius`)
              }
            />
          </div>
        )}
      </>
    )
  }

  return (
    <div className="w-20 shrink-0">
      <NumberField
        label="Opac."
        ariaLabel="Opacité"
        value={Math.round(layer.opacity * 100)}
        min={0}
        max={100}
        onChange={(percent) => update({ opacity: percent / 100 }, `layer:${layer.id}:opacity`)}
      />
    </div>
  )
}

/**
 * Poser une capture dans l'appareil : c'est l'action même du produit, elle ne
 * peut pas coûter la réouverture d'un drawer. Le message d'erreur passe par un
 * toast, la barre n'a pas de place pour une ligne d'aide.
 */
function ScreenshotButton({ onPick }: { onPick: (assetId: string, size: ScreenshotSize) => void }) {
  const input = useRef<HTMLInputElement>(null)

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const image = await importImageFile(file, SCREENSHOT_IMAGE_TYPES)
      onPick(registerAsset(image.dataUrl), { width: image.width, height: image.height })
    } catch (error) {
      toast(imageImportErrorMessage(error), 'error')
    }
  }

  return (
    <>
      <IconButton
        size="sm"
        aria-label="Choisir la capture"
        title="Choisir la capture"
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={14} strokeWidth={1.6} aria-hidden />
      </IconButton>
      <input
        ref={input}
        type="file"
        accept={SCREENSHOT_IMAGE_ACCEPT}
        className="hidden"
        onChange={handleChange}
      />
    </>
  )
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)

  return (
    <>
      <SwatchButton
        ref={anchor}
        className="size-8"
        color={value}
        selected={open}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      <Popover
        open={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
        className="w-60 p-2"
        role="dialog"
        ariaLabel={label}
      >
        <ColorPicker value={value} onChange={onChange} showOpacity />
      </Popover>
    </>
  )
}
