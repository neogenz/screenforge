import { useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { CURRENT_DEVICE_FRAMES, getDefaultDeviceSize, getDeviceFrame } from '@/assets/device-frames'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { Field } from '@/components/properties-panel/TransformSection'
import { Toggle } from '@/components/text-editor/TextEditor'
import { cn } from '@/lib/utils'
import type { DeviceColor, DeviceFrameLayer, DeviceModel, Orientation } from '@/types'

interface DevicePickerProps {
  deviceModel: DeviceModel
  deviceColor: DeviceColor
  orientation: Orientation
  width: number
  height: number
  screenshotUrl?: string
  shadowEnabled: boolean
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  onUpdate: (updates: Partial<DeviceFrameLayer>) => void
}

export function DevicePicker({
  deviceModel,
  deviceColor,
  orientation,
  width,
  height,
  screenshotUrl,
  shadowEnabled,
  shadowBlur,
  shadowColor,
  shadowOffsetX,
  shadowOffsetY,
  onUpdate,
}: DevicePickerProps) {
  const [shadowOpen, setShadowOpen] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const config = getDeviceFrame(deviceModel)
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
      const screenshot = await readAsDataUrl(file)
      await decodeImage(screenshot)
      onUpdate({ screenshotUrl: screenshot })
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
        <select
          value={deviceModel}
          onChange={(event) => handleModelChange(event.target.value as DeviceModel)}
          className="input"
          aria-label="Modèle d’appareil"
        >
          {modelOptions.map((frame) => (
            <option key={frame.model} value={frame.model}>
              {frame.modelName} · {frame.screenSize}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Couleur">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Couleur de l’appareil">
          {config.colors.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => onUpdate({ deviceColor: color.name })}
              title={color.label}
              aria-label={color.label}
              aria-pressed={deviceColor === color.name}
              className={cn(
                'relative h-7 w-7 rounded-full border transition-[border-color,transform] duration-100 ease-out',
                deviceColor === color.name
                  ? 'scale-110 border-foreground'
                  : 'border-border hover:border-border-strong',
              )}
              style={{ backgroundColor: color.frame }}
            >
              {deviceColor === color.name && (
                <Check
                  size={10}
                  aria-hidden
                  className="absolute inset-0 m-auto"
                  style={{ color: isLightColor(color.frame) ? '#000' : '#fff' }}
                  strokeWidth={2.5}
                />
              )}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Orientation">
        <div className="seg w-full" role="group" aria-label="Orientation">
          {(['portrait', 'landscape'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleOrientationChange(value)}
              data-active={orientation === value}
              className="seg-btn flex-1"
              aria-pressed={orientation === value}
            >
              {value}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Capture d’écran">
        {screenshotUrl ? (
          <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-panel p-1.5">
            <img
              src={screenshotUrl}
              alt="Capture importée"
              className="h-8 w-8 shrink-0 rounded-sm border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mono-label-strong min-h-8 flex-1 text-left transition-colors hover:text-foreground"
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ screenshotUrl: undefined })}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-surface-hover hover:text-danger"
              aria-label="Supprimer la capture"
            >
              <X size={13} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-md border border-dashed border-border',
              'mono-label transition-colors duration-100 ease-out',
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
          <span className="mono-label-strong">Ombre</span>
          <div className="flex items-center gap-1">
            <Toggle
              active={shadowEnabled}
              label="Activer l’ombre de l’appareil"
              onToggle={() => onUpdate({ shadowEnabled: !shadowEnabled })}
            />
            <button
              type="button"
              onClick={() => setShadowOpen((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              aria-label={shadowOpen ? 'Replier l’ombre' : 'Déplier l’ombre'}
              aria-expanded={shadowOpen}
            >
              <ChevronDown
                size={13}
                strokeWidth={1.75}
                aria-hidden
                className={cn('transition-transform duration-150', shadowOpen && 'rotate-180')}
              />
            </button>
          </div>
        </div>

        {shadowOpen && shadowEnabled && (
          <div className="flex flex-col gap-2 pl-3">
            <div className="flex items-center gap-2">
              <span className="mono-label w-8">Flou</span>
              <input
                type="range"
                min={0}
                max={60}
                value={shadowBlur}
                onChange={(event) => onUpdate({ shadowBlur: Number(event.target.value) })}
                className="flex-1 cursor-pointer"
                aria-label="Flou de l’ombre"
              />
              <span className="mono-value w-6 text-right text-[10px] text-foreground-muted">{shadowBlur}</span>
            </div>
            <Field label="Couleur">
              <ColorPicker value={shadowColor} showOpacity onChange={(color) => onUpdate({ shadowColor: color })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="X">
                <input
                  type="number"
                  value={shadowOffsetX}
                  onChange={(event) => onUpdate({ shadowOffsetX: clampNumber(event.target.value, -500, 500) })}
                  className="input"
                  aria-label="Décalage X de l’ombre"
                />
              </Field>
              <Field label="Y">
                <input
                  type="number"
                  value={shadowOffsetY}
                  onChange={(event) => onUpdate({ shadowOffsetY: clampNumber(event.target.value, -500, 500) })}
                  className="input"
                  aria-label="Décalage Y de l’ombre"
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

function decodeImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Unable to decode image'))
    image.src = src
  })
}

function clampNumber(value: string, min: number, max: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
}

function isLightColor(hex: string): boolean {
  const red = parseInt(hex.slice(1, 3), 16)
  const green = parseInt(hex.slice(3, 5), 16)
  const blue = parseInt(hex.slice(5, 7), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155
}
