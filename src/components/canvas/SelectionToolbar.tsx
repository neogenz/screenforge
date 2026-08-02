import { useRef, useState } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
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
import { Segmented } from '@/components/ui/segmented'
import { SwatchButton } from '@/components/ui/swatch-button'
import { getDeviceFrame } from '@/assets/device-frames'
import { registerAsset } from '@/lib/assets'
import { decodeImage, isSupportedImageFile, readAsDataUrl } from '@/lib/image'
import { toast } from '@/stores/toast.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'
import type { SelectionFrame } from '@/hooks/use-canvas'
import type { AlignMode } from '@/lib/align'
import type { Layer, TextLayer } from '@/types'

/** Hauteur fixe de la barre : évite de la mesurer pour décider du basculement. */
const BAR_HEIGHT = 36
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

const TEXT_ALIGNMENTS: { value: TextLayer['textAlign']; label: string }[] = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Droite' },
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
  const layers = useCanvasStore((state) => state.layers)
  const selectedLayerIds = useCanvasStore((state) => state.selectedLayerIds)

  if (propsOpen || !frame || selectedLayerIds.length === 0) return null
  const selected = layers.filter((layer) => selectedLayerIds.includes(layer.id))
  if (selected.length === 0) return null

  // Sous la sélection par défaut ; au-dessus quand le bas du stage n'a plus la
  // place, ce qui arrive dès qu'on travaille sur le bas d'un artboard.
  const below = frame.top + frame.height + OFFSET
  const flipped = below + BAR_HEIGHT + EDGE > frame.stageHeight
  const top = flipped
    ? Math.max(EDGE, frame.top - OFFSET - BAR_HEIGHT)
    : below

  return (
    <div
      className="island animate-fade-in pointer-events-auto absolute z-(--z-chrome)
        flex h-9 max-w-[min(680px,calc(100%-24px))] items-center gap-0.5 overflow-x-auto px-1"
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
      {selected.length === 1 ? <LayerControls layer={selected[0]} /> : <MultiCount count={selected.length} />}
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
        className="hover:text-danger"
        onClick={() => {
          for (const id of selectedLayerIds) useCanvasStore.getState().removeLayer(id)
        }}
      >
        <Trash2 size={14} strokeWidth={1.6} aria-hidden />
      </IconButton>
    </div>
  )
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
}

function MultiCount({ count }: { count: number }) {
  return (
    <span className="field-label tabular shrink-0 whitespace-nowrap px-1.5">
      {count} calques
    </span>
  )
}

/** Les réglages les plus utilisés du type sélectionné, jamais l'inventaire complet. */
function LayerControls({ layer }: { layer: Layer }) {
  const update = (updates: Partial<Layer>, coalesceKey?: string) =>
    useCanvasStore.getState().updateLayer(layer.id, updates, coalesceKey ? { coalesceKey } : undefined)

  if (layer.type === 'text') {
    return (
      <>
        <div className="w-28 shrink-0">
          <FontPicker
            value={layer.fontFamily}
            onChange={(fontFamily) => update({ fontFamily } as Partial<Layer>)}
          />
        </div>
        <div className="w-16 shrink-0">
          <NumberField
            ariaLabel="Taille du texte"
            value={layer.fontSize}
            min={8}
            max={400}
            onChange={(fontSize) =>
              update({ fontSize } as Partial<Layer>, `layer:${layer.id}:fontSize`)}
          />
        </div>
        <ColorControl
          label="Couleur du texte"
          value={layer.color}
          onChange={(color) => update({ color } as Partial<Layer>, `layer:${layer.id}:color`)}
        />
        <Segmented
          className="shrink-0"
          ariaLabel="Alignement du texte"
          options={TEXT_ALIGNMENTS.map((option) => ({
            value: option.value,
            label: option.label,
            ariaLabel: `Aligner le texte à ${option.label.toLowerCase()}`,
          }))}
          value={layer.textAlign}
          onChange={(textAlign) => update({ textAlign } as Partial<Layer>)}
        />
      </>
    )
  }

  if (layer.type === 'device-frame') {
    const colors = getDeviceFrame(layer.deviceModel).colors
    return (
      <>
        <span className="field-label shrink-0 whitespace-nowrap px-1">
          {getDeviceFrame(layer.deviceModel).modelName}
        </span>
        <ScreenshotButton
          onPick={(screenshotAssetId) => update({ screenshotAssetId } as Partial<Layer>)}
        />
        {colors.map((color) => (
          <SwatchButton
            key={color.name}
            className="h-6 w-6"
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
                update({ borderRadius } as Partial<Layer>, `layer:${layer.id}:borderRadius`)}
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
        onChange={(percent) =>
          update({ opacity: percent / 100 }, `layer:${layer.id}:opacity`)}
      />
    </div>
  )
}

/**
 * Poser une capture dans l'appareil : c'est l'action même du produit, elle ne
 * peut pas coûter la réouverture d'un drawer. Le message d'erreur passe par un
 * toast, la barre n'a pas de place pour une ligne d'aide.
 */
function ScreenshotButton({ onPick }: { onPick: (assetId: string) => void }) {
  const input = useRef<HTMLInputElement>(null)

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isSupportedImageFile(file)) {
      toast('Format non pris en charge. Utilisez un PNG ou un JPEG.', 'error')
      return
    }
    try {
      const dataUrl = await readAsDataUrl(file)
      await decodeImage(dataUrl)
      onPick(registerAsset(dataUrl))
    } catch {
      toast('La capture est illisible ou endommagée.', 'error')
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
        accept="image/png,image/jpeg"
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
        className="h-6 w-6"
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
