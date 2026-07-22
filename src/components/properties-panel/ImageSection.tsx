import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { inputCls, Field } from './TransformSection'
import { Toggle } from '@/components/text-editor/TextEditor'
import { cn } from '@/lib/utils'
import type { ImageLayer, TextShadow } from '@/types'

interface ImageSectionProps {
  layer: ImageLayer
}

export function ImageSection({ layer }: ImageSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)
  const fileRef = useRef<HTMLInputElement>(null)

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        update({
          src,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
        })
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Replace image file"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex h-8 w-full items-center justify-center gap-2 rounded-md border border-border bg-panel',
            'mono-label-strong transition-colors duration-100 ease-out',
            'hover:border-border-strong hover:text-foreground',
          )}
        >
          <Upload size={11} strokeWidth={1.5} />
          Replace
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label-strong">Shadow</span>
          <Toggle active={!!layer.shadow} onToggle={handleShadowToggle} />
        </div>
        {layer.shadow && (
          <div className="flex flex-col gap-2 pl-3">
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
