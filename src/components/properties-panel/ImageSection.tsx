import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { Field } from './TransformSection'
import { Toggle } from '@/components/text-editor/TextEditor'
import { cn } from '@/lib/utils'
import type { ImageLayer, TextShadow } from '@/types'

interface ImageSectionProps {
  layer: ImageLayer
}

export function ImageSection({ layer }: ImageSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function update(patch: Partial<ImageLayer>) {
    updateLayer(layer.id, patch as Partial<import('@/types').Layer>)
  }

  function handleShadowToggle() {
    if (layer.shadow) {
      update({ shadow: undefined })
    } else {
      const shadow: TextShadow = { offsetX: 4, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.4)' }
      update({ shadow })
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileError(null)
    e.target.value = ''
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setFileError('Format non pris en charge. Utilisez un PNG, JPEG ou SVG.')
      return
    }

    try {
      const src = await readAsDataUrl(file)
      const dimensions = await decodeImage(src)
      update({
        src,
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
      })
    } catch {
      setFileError("L'image est illisible ou endommagée.")
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={(event) => void handleFileChange(event)}
          className="sr-only"
          aria-label="Replace image file"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-panel',
            'mono-label-strong transition-colors duration-100 ease-out',
            'hover:border-border-strong hover:text-foreground',
          )}
        >
          <Upload size={11} strokeWidth={1.5} />
          Replace
        </button>
        {fileError && (
          <p role="alert" className="mt-1.5 text-[11px] leading-relaxed text-danger">
            {fileError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label-strong">Shadow</span>
          <Toggle
            active={!!layer.shadow}
            label="Toggle image shadow"
            onToggle={handleShadowToggle}
          />
        </div>
        {layer.shadow && (
          <div className="flex flex-col gap-2 pl-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="X">
                <input
                  type="number"
                  value={layer.shadow.offsetX}
                  onChange={(e) =>
                    update({ shadow: { ...layer.shadow!, offsetX: clampNumber(e.target.value, -500, 500) } })
                  }
                  className="input"
                  aria-label="Shadow X offset"
                />
              </Field>
              <Field label="Y">
                <input
                  type="number"
                  value={layer.shadow.offsetY}
                  onChange={(e) =>
                    update({ shadow: { ...layer.shadow!, offsetY: clampNumber(e.target.value, -500, 500) } })
                  }
                  className="input"
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
                  update({ shadow: { ...layer.shadow!, blur: clampNumber(e.target.value, 0, 500) } })
                }
                className="input"
                aria-label="Shadow blur"
              />
            </Field>
            <Field label="Color">
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

function clampNumber(value: string, min: number, max: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
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

function decodeImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Unable to decode image'))
    image.src = src
  })
}
