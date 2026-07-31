import { useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { CURRENT_DEVICE_FRAMES, getDefaultDeviceSize, getDeviceFrame } from '@/assets/device-frames'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { NumberField } from '@/components/ui/number-field'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { SwatchButton } from '@/components/ui/swatch-button'
import { Switch } from '@/components/ui/switch'
import { registerAsset, resolveAsset } from '@/lib/assets'
import { DEFAULT_DEVICE_SHADOW_COLOR } from '@/lib/content-defaults'
import { decodeImage, readAsDataUrl } from '@/lib/image'
import { cn } from '@/lib/utils'
import type { DeviceFrameLayer, DeviceModel, Orientation } from '@/types'

interface DevicePickerProps {
  layer: DeviceFrameLayer
  onUpdate: (updates: Partial<DeviceFrameLayer>, options?: { coalesceKey?: string }) => void
}

const ORIENTATION_OPTIONS: SegmentedOption<Orientation>[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Paysage' },
]

export function DevicePicker({ layer, onUpdate }: DevicePickerProps) {
  const { deviceModel, deviceColor, orientation, width, height, screenshotAssetId } = layer
  const shadowEnabled = layer.shadowEnabled ?? false
  const shadowBlur = layer.shadowBlur ?? 0
  const shadowColor = layer.shadowColor ?? DEFAULT_DEVICE_SHADOW_COLOR
  const shadowOffsetX = layer.shadowOffsetX ?? 0
  const shadowOffsetY = layer.shadowOffsetY ?? 0
  const shadowCoalesceKey = `layer:${layer.id}:shadow`

  const [modelOpen, setModelOpen] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const config = getDeviceFrame(deviceModel)
  const screenshotUrl = resolveAsset(screenshotAssetId)
  const modelOptions = config.current
    ? CURRENT_DEVICE_FRAMES
    : [config, ...CURRENT_DEVICE_FRAMES]

  async function handleScreenshotChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileError(null)
    event.target.value = ''
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setFileError('Format non pris en charge. Utilisez un PNG ou un JPEG.')
      return
    }

    try {
      const dataUrl = await readAsDataUrl(file)
      await decodeImage(dataUrl)
      onUpdate({ screenshotAssetId: registerAsset(dataUrl) })
    } catch {
      setFileError("La capture est illisible ou endommagée.")
    }
  }

  function handleModelChange(model: DeviceModel) {
    const next = getDeviceFrame(model)
    const canonical = getDefaultDeviceSize(model)
    const size = orientation === 'portrait'
      ? canonical
      : { width: canonical.height, height: canonical.width }
    onUpdate({ deviceModel: model, deviceColor: next.colors[0].name, ...size })
  }

  function handleOrientationChange(next: Orientation) {
    if (next === orientation) return
    const shortSide = Math.min(width, height)
    const longSide = Math.max(width, height)
    onUpdate({
      orientation: next,
      width: next === 'portrait' ? shortSide : longSide,
      height: next === 'portrait' ? longSide : shortSide,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Modèle">
        <Button
          ref={modelButtonRef}
          variant="default"
          className="w-full justify-between"
          onClick={() => setModelOpen((open) => !open)}
          aria-label="Modèle d’appareil"
          aria-expanded={modelOpen}
        >
          <span className="truncate">{config.modelName}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="mono-value text-[10px] text-faint">{config.screenSize}</span>
            <ChevronDown
              size={12}
              strokeWidth={1.5}
              aria-hidden
              className={cn('transition-transform duration-150 ease-out', modelOpen && 'rotate-180')}
            />
          </span>
        </Button>
      </Field>
      <Dropdown
        open={modelOpen}
        anchor={modelButtonRef}
        onClose={() => setModelOpen(false)}
        items={modelOptions.map((frame) => ({
          id: frame.model,
          label: frame.modelName,
          meta: frame.screenSize,
          onSelect: () => handleModelChange(frame.model),
        }))}
        ariaLabel="Modèle d’appareil"
      />

      <Field label="Couleur">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Couleur de l’appareil">
          {config.colors.map((color) => (
            <SwatchButton
              key={color.name}
              color={color.frame}
              selected={deviceColor === color.name}
              onClick={() => onUpdate({ deviceColor: color.name })}
              title={color.label}
              aria-label={color.label}
            />
          ))}
        </div>
      </Field>

      <Field label="Orientation">
        <Segmented
          options={ORIENTATION_OPTIONS}
          value={orientation}
          onChange={handleOrientationChange}
          ariaLabel="Orientation"
          className="w-full"
        />
      </Field>

      <Field label="Capture d’écran">
        {screenshotUrl ? (
          <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-panel p-1.5">
            <img
              src={screenshotUrl}
              alt="Capture importée"
              className="h-8 w-8 shrink-0 rounded-sm border border-border object-cover"
            />
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start"
              onClick={() => fileInputRef.current?.click()}
            >
              Remplacer
            </Button>
            <IconButton
              size="sm"
              aria-label="Supprimer la capture"
              className="hover:text-danger"
              onClick={() => onUpdate({ screenshotAssetId: undefined })}
            >
              <X size={13} strokeWidth={1.5} aria-hidden />
            </IconButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-md border border-dashed border-border',
              'caps-label transition-colors duration-150 ease-out',
              'hover:border-border-strong hover:text-foreground',
            )}
          >
            Aucune capture · importer un PNG/JPEG
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          aria-label="Importer la capture de l’app"
          onChange={(event) => void handleScreenshotChange(event)}
        />
        {fileError && (
          <p role="alert" className="mt-1.5 text-[11px] leading-relaxed text-danger">
            {fileError}
          </p>
        )}
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="caps-label-strong">Ombre</span>
          <Switch
            checked={shadowEnabled}
            ariaLabel="Activer l’ombre de l’appareil"
            onChange={(checked) => onUpdate({ shadowEnabled: checked })}
          />
        </div>

        {shadowEnabled && (
          <div className="flex flex-col gap-2">
            <NumberField
              label="Flou"
              ariaLabel="Flou de l’ombre"
              value={shadowBlur}
              onChange={(value) => onUpdate({ shadowBlur: value }, { coalesceKey: shadowCoalesceKey })}
              min={0}
              max={100}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                ariaLabel="Décalage X de l’ombre"
                value={shadowOffsetX}
                onChange={(value) => onUpdate({ shadowOffsetX: value }, { coalesceKey: shadowCoalesceKey })}
                min={-500}
                max={500}
              />
              <NumberField
                label="Y"
                ariaLabel="Décalage Y de l’ombre"
                value={shadowOffsetY}
                onChange={(value) => onUpdate({ shadowOffsetY: value }, { coalesceKey: shadowCoalesceKey })}
                min={-500}
                max={500}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="caps-label">Couleur</span>
              <ColorPicker
                value={shadowColor}
                showOpacity
                onChange={(color) => onUpdate({ shadowColor: color }, { coalesceKey: shadowCoalesceKey })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
