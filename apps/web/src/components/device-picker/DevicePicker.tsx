import { useRef, useState } from 'react'
import { ChevronDown, ExternalLink, Upload, X } from 'lucide-react'
import {
  currentDeviceFramesFor,
  getDefaultDeviceSize,
  getDeviceFrame,
} from '@/assets/device-frames'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { ScreenshotFraming } from '@/components/device-picker/ScreenshotFraming'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { NumberField } from '@/components/ui/number-field'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { SwatchButton } from '@/components/ui/swatch-button'
import { Switch } from '@/components/ui/switch'
import { registerAsset, resolveAsset } from '@/lib/assets'
import { DEFAULT_DEVICE_SHADOW_COLOR } from '@/lib/content-defaults'
import { analyzeDeviceBezel } from '@/lib/device-bezel'
import {
  imageImportErrorMessage,
  importImageFile,
  SCREENSHOT_IMAGE_ACCEPT,
  SCREENSHOT_IMAGE_TYPES,
} from '@/lib/image'
import { cn } from '@/lib/utils'
import { getAppStoreProfile } from '@/lib/dimensions'
import { useProjectStore } from '@/stores/project.store'
import type { DeviceFrameLayer, DeviceModel, Orientation } from '@/types'

interface DevicePickerProps {
  layer: DeviceFrameLayer
  onUpdate: (updates: Partial<DeviceFrameLayer>, options?: { coalesceKey?: string }) => void
}

const ORIENTATION_OPTIONS: SegmentedOption<Orientation>[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Paysage' },
]

const SOURCE_OPTIONS: SegmentedOption<'generated' | 'apple'>[] = [
  { value: 'generated', label: 'ScreenForge' },
  { value: 'apple', label: 'Apple officiel' },
]

export function DevicePicker({ layer, onUpdate }: DevicePickerProps) {
  const profileId = useProjectStore((state) => state.project?.profileId ?? 'iphone-6.9')
  const platform = getAppStoreProfile(profileId)!.platform
  const { deviceModel, deviceColor, orientation, width, height, screenshotAssetId } = layer
  const shadowEnabled = layer.shadowEnabled ?? false
  const shadowBlur = layer.shadowBlur ?? 0
  const shadowColor = layer.shadowColor ?? DEFAULT_DEVICE_SHADOW_COLOR
  const shadowOffsetX = layer.shadowOffsetX ?? 0
  const shadowOffsetY = layer.shadowOffsetY ?? 0
  const shadowCoalesceKey = `layer:${layer.id}:shadow`

  const [modelOpen, setModelOpen] = useState(false)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)
  const [bezelError, setBezelError] = useState<string | null>(null)
  const [bezelLoading, setBezelLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bezelInputRef = useRef<HTMLInputElement>(null)
  const bezelRequestRef = useRef(0)
  const bezelBusyRef = useRef(false)
  const config = getDeviceFrame(deviceModel)
  const screenshotUrl = resolveAsset(screenshotAssetId)
  const bezelUrl = resolveAsset(layer.importedBezel?.assetId)
  const compatibleFrames = currentDeviceFramesFor(platform)
  const modelOptions =
    config.current && config.platform === platform
      ? compatibleFrames
      : [config, ...compatibleFrames]

  async function handleScreenshotChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setScreenshotError(null)
    event.target.value = ''

    try {
      const image = await importImageFile(file, SCREENSHOT_IMAGE_TYPES)
      /* La taille est écrite, le cadrage ne l'est pas : c'est toute la
         différence avec Open Screenshot Generator, dont le remplacement remet
         le `screenshotRect` à zéro et fait donc reperdre le réglage à chaque
         release. Ici seul l'asset et sa mesure changent — le mode, le point
         focal, le zoom, le slot, la géométrie, l'appareil et l'ombre restent. */
      onUpdate({
        screenshotAssetId: registerAsset(image.dataUrl),
        screenshotSize: { width: image.width, height: image.height },
      })
    } catch (error) {
      setScreenshotError(imageImportErrorMessage(error))
    }
  }

  async function handleBezelChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || bezelBusyRef.current) return

    bezelBusyRef.current = true
    const requestId = ++bezelRequestRef.current
    setBezelError(null)
    setBezelLoading(true)
    try {
      const result = await analyzeDeviceBezel(file)
      if (requestId !== bezelRequestRef.current) return
      const assetId = registerAsset(result.dataUrl)
      const longSide = Math.max(width, height)
      const portrait = result.metadata.naturalHeight >= result.metadata.naturalWidth
      const ratio = result.metadata.naturalWidth / result.metadata.naturalHeight
      onUpdate({
        importedBezel: { assetId, ...result.metadata },
        width: portrait ? Math.round(longSide * ratio) : longSide,
        height: portrait ? longSide : Math.round(longSide / ratio),
        orientation: 'portrait',
        rotation: 0,
        opacity: 1,
        shadowEnabled: false,
      })
    } catch (error) {
      if (requestId !== bezelRequestRef.current) return
      setBezelError(error instanceof Error ? error.message : 'Le bezel est illisible.')
    } finally {
      if (requestId === bezelRequestRef.current) {
        bezelBusyRef.current = false
        setBezelLoading(false)
      }
    }
  }

  function removeImportedBezel() {
    const canonical = getDefaultDeviceSize(deviceModel)
    const longSide = Math.max(width, height)
    const ratio = canonical.width / canonical.height
    onUpdate({
      importedBezel: undefined,
      width: Math.round(longSide * ratio),
      height: longSide,
      orientation: 'portrait',
    })
    setBezelError(null)
  }

  function handleModelChange(model: DeviceModel) {
    const next = getDeviceFrame(model)
    const canonical = getDefaultDeviceSize(model)
    const size =
      orientation === 'portrait' ? canonical : { width: canonical.height, height: canonical.width }
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
      <Field label="Source">
        <Segmented
          options={SOURCE_OPTIONS}
          value={layer.importedBezel ? 'apple' : 'generated'}
          onChange={(source) => {
            if (source === 'apple') bezelInputRef.current?.click()
            else if (layer.importedBezel) removeImportedBezel()
          }}
          ariaLabel="Source du cadre"
          disabled={bezelLoading}
        />
      </Field>
      <input
        ref={bezelInputRef}
        type="file"
        accept="image/png"
        className="sr-only"
        aria-label="Importer un bezel Apple"
        disabled={bezelLoading}
        onChange={(event) => void handleBezelChange(event)}
      />

      {layer.importedBezel ? (
        <Field label="Bezel Apple">
          <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-card p-1.5">
            {bezelUrl && (
              <img src={bezelUrl} alt="Bezel importé" className="h-8 w-8 shrink-0 object-contain" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {layer.importedBezel.fileName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={bezelLoading}
              onClick={() => bezelInputRef.current?.click()}
              aria-label="Remplacer le bezel Apple"
            >
              Remplacer
            </Button>
            <IconButton
              size="sm"
              disabled={bezelLoading}
              aria-label="Retirer le bezel Apple"
              className="hover:text-destructive"
              onClick={removeImportedBezel}
            >
              <X size={13} strokeWidth={1.5} aria-hidden />
            </IconButton>
          </div>
        </Field>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="default"
            size="sm"
            loading={bezelLoading}
            onClick={() => bezelInputRef.current?.click()}
          >
            <Upload size={13} strokeWidth={1.5} aria-hidden />
            Importer le PNG Apple
          </Button>
          <a
            href="https://developer.apple.com/design/resources/#product-bezels"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Télécharger le DMG chez Apple
            <ExternalLink size={10} strokeWidth={1.5} aria-hidden />
          </a>
          <span className="text-2xs text-muted-foreground">
            Fichier fourni localement par l’utilisateur sous licence Apple. ScreenForge ne le
            télécharge ni ne le redistribue.
          </span>
        </div>
      )}
      {bezelError && (
        <p role="alert" className="text-2xs text-destructive">
          {bezelError}
        </p>
      )}

      {!layer.importedBezel && (
        <Field label="Modèle">
          <Dropdown
            open={modelOpen}
            onOpenChange={setModelOpen}
            trigger={
              /* Pas d'aria-label ici : le nom accessible naît du contenu
                 visible (« iPhone 17 Pro Max · 6,9″ »), donc une commande
                 vocale qui lit l'étiquette à voix haute le nomme exactement
                 (WCAG 2.5.3). « Modèle d'appareil » ne recouvrait pas ce que
                 l'écran affiche. */
              <Button variant="default" className="w-full justify-between">
                <span className="truncate">{config.modelName}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular text-2xs text-muted-foreground">
                    {config.screenSize}
                  </span>
                  <ChevronDown
                    size={12}
                    strokeWidth={1.5}
                    aria-hidden
                    className={cn(
                      'transition-transform duration-150 ease-out',
                      modelOpen && 'rotate-180',
                    )}
                  />
                </span>
              </Button>
            }
            items={modelOptions.map((frame) => ({
              id: frame.model,
              label: frame.modelName,
              meta: frame.screenSize,
              onSelect: () => handleModelChange(frame.model),
            }))}
            ariaLabel="Modèle d’appareil"
          />
        </Field>
      )}

      {!layer.importedBezel && (
        <Field label="Couleur">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Couleur de l’appareil">
            {config.colors.map((color) => (
              <SwatchButton
                key={color.name}
                color={color.frame}
                selected={deviceColor === color.name}
                onClick={() => onUpdate({ deviceColor: color.name })}
                tooltip={color.label}
                aria-label={color.label}
              />
            ))}
          </div>
        </Field>
      )}

      {!layer.importedBezel && (
        <Field label="Orientation">
          <Segmented
            options={ORIENTATION_OPTIONS}
            value={orientation}
            onChange={handleOrientationChange}
            ariaLabel="Orientation"
          />
        </Field>
      )}

      <Field label="Capture d’écran">
        {screenshotUrl ? (
          <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-card p-1.5">
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
              className="hover:text-destructive"
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
              'field-label transition-colors duration-150 ease-out',
              'hover:border-input hover:text-foreground',
            )}
          >
            Aucune capture · importer un PNG/JPEG
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={SCREENSHOT_IMAGE_ACCEPT}
          className="sr-only"
          aria-label="Importer la capture de l’app"
          onChange={(event) => void handleScreenshotChange(event)}
        />
        {screenshotError && (
          <p role="alert" className="mt-1.5 text-2xs text-destructive">
            {screenshotError}
          </p>
        )}
      </Field>

      <ScreenshotFraming layer={layer} onUpdate={onUpdate} />

      {layer.importedBezel ? (
        <p className="text-2xs text-muted-foreground">
          Apple demande d’utiliser ce bezel tel quel : sans rotation, opacité ni ombre.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Ombre</h3>
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
                onChange={(value) =>
                  onUpdate({ shadowBlur: value }, { coalesceKey: shadowCoalesceKey })
                }
                min={0}
                max={100}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="X"
                  ariaLabel="Décalage X de l’ombre"
                  value={shadowOffsetX}
                  onChange={(value) =>
                    onUpdate({ shadowOffsetX: value }, { coalesceKey: shadowCoalesceKey })
                  }
                  min={-500}
                  max={500}
                />
                <NumberField
                  label="Y"
                  ariaLabel="Décalage Y de l’ombre"
                  value={shadowOffsetY}
                  onChange={(value) =>
                    onUpdate({ shadowOffsetY: value }, { coalesceKey: shadowCoalesceKey })
                  }
                  min={-500}
                  max={500}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="field-label">Couleur</span>
                <ColorPicker
                  value={shadowColor}
                  showOpacity
                  onChange={(color) =>
                    onUpdate({ shadowColor: color }, { coalesceKey: shadowCoalesceKey })
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
